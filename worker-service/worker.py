import time
import redis
import signal
import sys
import logging
from datetime import datetime

# ─── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] worker: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S"
)
logger = logging.getLogger("worker-service")

# ─── Redis Connection ─────────────────────────────────────────────────────────
import os

REDIS_HOST = os.environ.get("REDIS_HOST", "redis")
REDIS_PORT = int(os.environ.get("REDIS_PORT", 6379))

redis_client = None
running = True

def connect_redis():
    global redis_client
    while True:
        try:
            redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, socket_connect_timeout=5)
            redis_client.ping()
            logger.info(f"✅ Connected to Redis at {REDIS_HOST}:{REDIS_PORT}")
            break
        except redis.ConnectionError as e:
            logger.warning(f"Cannot connect to Redis: {e}. Retrying in 5s...")
            time.sleep(5)

# ─── Graceful Shutdown ────────────────────────────────────────────────────────
def handle_shutdown(sig, frame):
    global running
    logger.info("🛑 Shutdown signal received. Finishing current job...")
    running = False

signal.signal(signal.SIGTERM, handle_shutdown)
signal.signal(signal.SIGINT, handle_shutdown)

# ─── Job Counters ─────────────────────────────────────────────────────────────
jobs_processed = 0
jobs_failed = 0

# ─── Main Worker Loop ─────────────────────────────────────────────────────────
def process_jobs():
    global jobs_processed, jobs_failed, running

    logger.info("🚀 Worker started. Polling Redis queue 'job_queue'...")

    while running:
        try:
            job_data = redis_client.lpop("job_queue")

            if job_data:
                job = job_data.decode("utf-8")
                logger.info(f"📦 Processing job: {job}")

                # Simulate job processing
                time.sleep(2)

                jobs_processed += 1
                logger.info(f"✅ Job completed. Total processed: {jobs_processed}")

                # Write stats back to Redis for monitoring
                redis_client.set("worker:jobs_processed", jobs_processed)
                redis_client.set("worker:jobs_failed", jobs_failed)
                redis_client.set("worker:last_job_at", datetime.utcnow().isoformat())
            else:
                # No job, idle
                time.sleep(1)

        except redis.ConnectionError as e:
            logger.error(f"❌ Redis connection lost: {e}. Reconnecting...")
            jobs_failed += 1
            connect_redis()
        except Exception as e:
            logger.error(f"❌ Unexpected error processing job: {e}")
            jobs_failed += 1
            time.sleep(2)

    logger.info(f"👋 Worker shutting down. Processed: {jobs_processed}, Failed: {jobs_failed}")
    sys.exit(0)


if __name__ == "__main__":
    connect_redis()
    process_jobs()