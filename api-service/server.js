const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const Redis = require("ioredis");
const client = require("prom-client");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ─── Prometheus Metrics ───────────────────────────────────────────────────────
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5],
  registers: [register],
});

const httpRequestTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const activeUsers = new client.Gauge({
  name: "app_active_users_total",
  help: "Total number of users in the database",
  registers: [register],
});

const jobQueueLength = new client.Gauge({
  name: "job_queue_length",
  help: "Number of jobs waiting in the Redis queue",
  registers: [register],
});

// Middleware to record request metrics
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on("finish", () => {
    const labels = {
      method: req.method,
      route: req.route ? req.route.path : req.path,
      status_code: res.statusCode,
    };
    end(labels);
    httpRequestTotal.inc(labels);
  });
  next();
});

// ─── PostgreSQL ───────────────────────────────────────────────────────────────
const pool = new Pool({
  host: process.env.DB_HOST || "postgres",
  user: process.env.DB_USER || "admin",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "devopsdb",
  port: parseInt(process.env.DB_PORT || "5432"),
});

// ─── Redis ────────────────────────────────────────────────────────────────────
const redis = new Redis({
  host: process.env.REDIS_HOST || "redis",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.warn("Redis connection error:", err.message);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "API Service Running 🚀",
    version: "2.0.0",
    services: ["postgres", "redis"],
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok", db: "connected", service: "api-service" });
  } catch (err) {
    res.status(503).json({ status: "degraded", db: "disconnected", error: err.message });
  }
});

app.get("/metrics", async (req, res) => {
  // Update job queue gauge
  try {
    const queueLen = await redis.llen("job_queue");
    jobQueueLength.set(queueLen);
  } catch (_) {}

  // Update active users gauge
  try {
    const result = await pool.query("SELECT COUNT(*) FROM users");
    activeUsers.set(parseInt(result.rows[0].count));
  } catch (_) {}

  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Init DB table
app.get("/init", async (req, res) => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    res.json({ message: "Database initialized successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add user
app.post("/users", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Name is required" });
    }
    const result = await pool.query(
      "INSERT INTO users(name) VALUES($1) RETURNING *",
      [name.trim()]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get users
app.get("/users", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users ORDER BY id DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message, users: [] });
  }
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = $1", [req.params.id]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Enqueue job
app.post("/jobs", async (req, res) => {
  try {
    const { job } = req.body;
    if (!job) return res.status(400).json({ error: "Job payload is required" });
    await redis.rpush("job_queue", JSON.stringify({ job, timestamp: new Date().toISOString() }));
    const queueLen = await redis.llen("job_queue");
    res.json({ queued: true, job, queueLength: queueLen });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get job queue length
app.get("/jobs", async (req, res) => {
  try {
    const length = await redis.llen("job_queue");
    res.json({ queueLength: length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Only start server when run directly (not when imported by Jest)
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`✅ API Service running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => {
      pool.end();
      redis.quit();
      process.exit(0);
    });
  });
}

module.exports = app;