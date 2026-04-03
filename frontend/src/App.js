import { useEffect, useState, useCallback } from "react";
import "./App.css";

// Determine base URLs based on environment
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:3000";
const AUTH_URL = process.env.REACT_APP_AUTH_URL || "http://localhost:4000";

function App() {
  // ─── Auth State ─────────────────────────────────────────────────────────────
  const [token, setToken] = useState(localStorage.getItem("devops_token") || "");
  const [authUser, setAuthUser] = useState(localStorage.getItem("devops_user") || "");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // ─── Users State ────────────────────────────────────────────────────────────
  const [users, setUsers] = useState([]);
  const [newUserName, setNewUserName] = useState("");
  const [userError, setUserError] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);

  // ─── Jobs State ─────────────────────────────────────────────────────────────
  const [jobInput, setJobInput] = useState("");
  const [jobQueueLength, setJobQueueLength] = useState(0);
  const [jobMessage, setJobMessage] = useState("");
  const [isEnqueuing, setIsEnqueuing] = useState(false);

  // ─── Service Health State ────────────────────────────────────────────────────
  const [serviceHealth, setServiceHealth] = useState({
    api: { status: "checking", latency: null },
    auth: { status: "checking", latency: null },
  });

  // ─── Active Tab ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState("dashboard");

  // ─── Auth Functions ──────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch(`${AUTH_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setToken(data.token);
        setAuthUser(data.user);
        localStorage.setItem("devops_token", data.token);
        localStorage.setItem("devops_user", data.user);
        setLoginForm({ username: "", password: "" });
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch (err) {
      setLoginError("Cannot reach Auth Service. Is it running?");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setToken("");
    setAuthUser("");
    localStorage.removeItem("devops_token");
    localStorage.removeItem("devops_user");
  };

  // ─── DB Init ─────────────────────────────────────────────────────────────────
  const initDatabase = async () => {
    try {
      await fetch(`${API_URL}/init`);
      setDbInitialized(true);
      fetchUsers();
    } catch (err) {
      console.error("DB init error:", err);
    }
  };

  // ─── Users Functions ──────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    }
  }, []);

  const addUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    setIsAddingUser(true);
    setUserError("");
    try {
      const res = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newUserName.trim() }),
      });
      if (res.ok) {
        setNewUserName("");
        fetchUsers();
      } else {
        const err = await res.json();
        setUserError(err.error || "Failed to add user");
      }
    } catch {
      setUserError("Cannot reach API Service. Is it running?");
    } finally {
      setIsAddingUser(false);
    }
  };

  const deleteUser = async (id) => {
    try {
      await fetch(`${API_URL}/users/${id}`, { method: "DELETE" });
      fetchUsers();
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // ─── Jobs Functions ───────────────────────────────────────────────────────────
  const enqueueJob = async (e) => {
    e.preventDefault();
    if (!jobInput.trim()) return;
    setIsEnqueuing(true);
    setJobMessage("");
    try {
      const res = await fetch(`${API_URL}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job: jobInput.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setJobMessage(`✅ Job enqueued! Queue length: ${data.queueLength}`);
        setJobInput("");
        setJobQueueLength(data.queueLength);
      }
    } catch {
      setJobMessage("❌ Cannot reach API Service");
    } finally {
      setIsEnqueuing(false);
    }
  };

  const fetchJobQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/jobs`);
      const data = await res.json();
      setJobQueueLength(data.queueLength || 0);
    } catch {}
  }, []);

  // ─── Health Check ─────────────────────────────────────────────────────────────
  const checkHealth = useCallback(async () => {
    const checkService = async (url, key) => {
      const start = Date.now();
      try {
        const res = await fetch(`${url}/health`);
        const latency = Date.now() - start;
        setServiceHealth((prev) => ({
          ...prev,
          [key]: { status: res.ok ? "healthy" : "degraded", latency },
        }));
      } catch {
        setServiceHealth((prev) => ({
          ...prev,
          [key]: { status: "down", latency: null },
        }));
      }
    };
    await Promise.all([
      checkService(API_URL, "api"),
      checkService(AUTH_URL, "auth"),
    ]);
  }, []);

  // ─── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    checkHealth();
    fetchUsers();
    fetchJobQueue();
    const interval = setInterval(() => {
      checkHealth();
      fetchJobQueue();
    }, 15000);
    return () => clearInterval(interval);
  }, [checkHealth, fetchUsers, fetchJobQueue]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-icon">⚡</div>
          <div>
            <h1 className="brand-title">DevOps Platform</h1>
            <p className="brand-subtitle">Microservices Architecture</p>
          </div>
        </div>
        <nav className="header-nav">
          {["dashboard", "users", "jobs"].map((tab) => (
            <button
              key={tab}
              id={`nav-${tab}`}
              className={`nav-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "dashboard" && "📊 Dashboard"}
              {tab === "users" && "👥 Users"}
              {tab === "jobs" && "⚙️ Jobs"}
            </button>
          ))}
        </nav>
        <div className="header-auth">
          {token ? (
            <div className="auth-info">
              <span className="auth-badge">🔐 {authUser}</span>
              <button id="logout-btn" className="btn btn-ghost" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <button id="login-open-btn" className="btn btn-primary" onClick={() => setActiveTab("login")}>
              Login
            </button>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main">

        {/* ── Login Tab ── */}
        {activeTab === "login" && (
          <div className="tab-content">
            <div className="card login-card">
              <div className="card-header">
                <h2>🔐 Authentication Service</h2>
                <p className="card-subtitle">JWT-powered login via auth-service</p>
              </div>
              <form onSubmit={handleLogin} className="login-form">
                <div className="form-group">
                  <label htmlFor="login-username">Username</label>
                  <input
                    id="login-username"
                    type="text"
                    placeholder="admin / student / developer"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    type="password"
                    placeholder="Enter password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                </div>
                {loginError && <div className="alert alert-error">{loginError}</div>}
                <button id="login-submit-btn" type="submit" className="btn btn-primary btn-full" disabled={isLoggingIn}>
                  {isLoggingIn ? "🔄 Authenticating..." : "🔑 Login"}
                </button>
              </form>
              <div className="demo-creds">
                <p className="demo-label">Demo Credentials:</p>
                <div className="cred-grid">
                  <div className="cred-item"><span>admin</span><span>password</span></div>
                  <div className="cred-item"><span>student</span><span>devops123</span></div>
                  <div className="cred-item"><span>developer</span><span>dev2024</span></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Dashboard Tab ── */}
        {activeTab === "dashboard" && (
          <div className="tab-content">
            <div className="page-header">
              <h2>📊 Platform Dashboard</h2>
              <button id="refresh-health-btn" className="btn btn-ghost" onClick={checkHealth}>↺ Refresh</button>
            </div>

            <div className="stats-grid">
              {/* Service Health Cards */}
              {[
                { key: "api", label: "API Service", port: "3000", icon: "🚀" },
                { key: "auth", label: "Auth Service", port: "4000", icon: "🔐" },
              ].map(({ key, label, port, icon }) => (
                <div key={key} className={`stat-card status-${serviceHealth[key].status}`}>
                  <div className="stat-icon">{icon}</div>
                  <div className="stat-info">
                    <p className="stat-label">{label}</p>
                    <p className="stat-value">{serviceHealth[key].status.toUpperCase()}</p>
                    {serviceHealth[key].latency && (
                      <p className="stat-sub">{serviceHealth[key].latency}ms · :{port}</p>
                    )}
                  </div>
                  <div className={`status-dot dot-${serviceHealth[key].status}`} />
                </div>
              ))}

              <div className="stat-card">
                <div className="stat-icon">👥</div>
                <div className="stat-info">
                  <p className="stat-label">Total Users</p>
                  <p className="stat-value">{users.length}</p>
                  <p className="stat-sub">in database</p>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon">⚙️</div>
                <div className="stat-info">
                  <p className="stat-label">Job Queue</p>
                  <p className="stat-value">{jobQueueLength}</p>
                  <p className="stat-sub">pending jobs</p>
                </div>
              </div>
            </div>

            {/* Architecture Overview */}
            <div className="card architecture-card">
              <div className="card-header">
                <h3>🏗️ Service Architecture</h3>
              </div>
              <div className="arch-grid">
                {[
                  { name: "Frontend", tech: "React + Nginx", port: "8080", icon: "🌐", color: "#61dafb" },
                  { name: "API Service", tech: "Node.js + Express", port: "3000", icon: "🚀", color: "#68d391" },
                  { name: "Auth Service", tech: "Python + Flask", port: "4000", icon: "🔐", color: "#fc8181" },
                  { name: "Worker Service", tech: "Python + Redis", port: "—", icon: "⚙️", color: "#f6ad55" },
                  { name: "PostgreSQL", tech: "Database", port: "5432", icon: "🗄️", color: "#76e4f7" },
                  { name: "Redis", tech: "Cache + Queue", port: "6379", icon: "⚡", color: "#f6e05e" },
                  { name: "Prometheus", tech: "Metrics", port: "9090", icon: "📈", color: "#e53e3e" },
                  { name: "Grafana", tech: "Dashboards", port: "3001", icon: "📊", color: "#f6ad55" },
                ].map(({ name, tech, port, icon, color }) => (
                  <div key={name} className="arch-item" style={{ borderColor: color }}>
                    <div className="arch-icon" style={{ color }}>{icon}</div>
                    <p className="arch-name">{name}</p>
                    <p className="arch-tech">{tech}</p>
                    {port !== "—" && <p className="arch-port">:{port}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div className="card">
              <div className="card-header"><h3>🔗 Quick Links</h3></div>
              <div className="links-grid">
                {[
                  { label: "Prometheus", url: "http://localhost:9090", icon: "📈" },
                  { label: "Grafana", url: "http://localhost:3001", icon: "📊" },
                  { label: "API Health", url: `${API_URL}/health`, icon: "💚" },
                  { label: "API Metrics", url: `${API_URL}/metrics`, icon: "📉" },
                  { label: "Auth Health", url: `${AUTH_URL}/health`, icon: "🔐" },
                  { label: "Auth Metrics", url: `${AUTH_URL}/metrics`, icon: "📉" },
                ].map(({ label, url, icon }) => (
                  <a key={label} href={url} target="_blank" rel="noreferrer" className="quick-link">
                    <span>{icon}</span>
                    <span>{label}</span>
                    <span className="link-arrow">↗</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <div className="tab-content">
            <div className="page-header">
              <h2>👥 User Management</h2>
              <div className="page-actions">
                <button id="init-db-btn" className="btn btn-secondary" onClick={initDatabase}>
                  🗄️ Init Database
                </button>
                <button id="refresh-users-btn" className="btn btn-ghost" onClick={fetchUsers}>
                  ↺ Refresh
                </button>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Add New User</h3>
                <p className="card-subtitle">Creates a record in PostgreSQL via the API service</p>
              </div>
              <form onSubmit={addUser} className="inline-form">
                <input
                  id="new-user-input"
                  type="text"
                  placeholder="Enter full name..."
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                />
                <button id="add-user-btn" type="submit" className="btn btn-primary" disabled={isAddingUser}>
                  {isAddingUser ? "Adding..." : "+ Add User"}
                </button>
              </form>
              {userError && <div className="alert alert-error">{userError}</div>}
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Users <span className="badge">{users.length}</span></h3>
              </div>
              {users.length === 0 ? (
                <div className="empty-state">
                  <p>🗄️ No users found. Click "Init Database" first, then add users.</p>
                </div>
              ) : (
                <div className="users-list">
                  {users.map((u) => (
                    <div key={u.id} className="user-item">
                      <div className="user-avatar">{u.name.charAt(0).toUpperCase()}</div>
                      <div className="user-info">
                        <p className="user-name">{u.name}</p>
                        <p className="user-id">ID: {u.id}</p>
                      </div>
                      <button
                        id={`delete-user-${u.id}`}
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteUser(u.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Jobs Tab ── */}
        {activeTab === "jobs" && (
          <div className="tab-content">
            <div className="page-header">
              <h2>⚙️ Worker Job Queue</h2>
            </div>

            <div className="stats-grid jobs-stats">
              <div className="stat-card">
                <div className="stat-icon">📦</div>
                <div className="stat-info">
                  <p className="stat-label">Queue Length</p>
                  <p className="stat-value">{jobQueueLength}</p>
                  <p className="stat-sub">pending in Redis</p>
                </div>
              </div>
              <div className="stat-card status-healthy">
                <div className="stat-icon">⚡</div>
                <div className="stat-info">
                  <p className="stat-label">Redis</p>
                  <p className="stat-value">CONNECTED</p>
                  <p className="stat-sub">:6379</p>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3>Enqueue a Job</h3>
                <p className="card-subtitle">Pushes a job to Redis — the worker-service will process it</p>
              </div>
              <form onSubmit={enqueueJob} className="inline-form">
                <input
                  id="job-input"
                  type="text"
                  placeholder="e.g. send-email, resize-image, generate-report..."
                  value={jobInput}
                  onChange={(e) => setJobInput(e.target.value)}
                />
                <button id="enqueue-job-btn" type="submit" className="btn btn-primary" disabled={isEnqueuing}>
                  {isEnqueuing ? "Queuing..." : "📤 Enqueue"}
                </button>
              </form>
              {jobMessage && <div className="alert alert-success">{jobMessage}</div>}
            </div>

            <div className="card">
              <div className="card-header"><h3>📋 How the Worker Service Works</h3></div>
              <div className="how-it-works">
                {[
                  { step: "1", label: "Enqueue", desc: "You submit a job via this form → POST /jobs → Redis RPUSH" },
                  { step: "2", label: "Queue", desc: "Job sits in Redis list 'job_queue' — FIFO order maintained" },
                  { step: "3", label: "Process", desc: "Worker polls Redis with LPOP — picks up jobs in order" },
                  { step: "4", label: "Complete", desc: "Worker logs job completion and updates stats in Redis" },
                ].map(({ step, label, desc }) => (
                  <div key={step} className="step-item">
                    <div className="step-number">{step}</div>
                    <div className="step-content">
                      <p className="step-label">{label}</p>
                      <p className="step-desc">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="footer">
        <p>
          Microservices DevOps Platform · Built with React · Node.js · Python · Docker · Kubernetes
        </p>
      </footer>
    </div>
  );
}

export default App;