from flask import Flask, request, jsonify
from flask_cors import CORS
from prometheus_flask_exporter import PrometheusMetrics
import jwt
import datetime
import os
import logging

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("auth-service")

# Prometheus metrics
metrics = PrometheusMetrics(app)
metrics.info("auth_service_info", "Auth Service Info", version="2.0.0")

# Secret key from environment variable
SECRET_KEY = os.environ.get("SECRET_KEY", "supersecretkey-change-in-production")

# ─── Routes ───────────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return jsonify({
        "message": "Auth Service Running 🔐",
        "version": "2.0.0",
        "endpoints": ["/health", "/login", "/verify", "/metrics"]
    })

@app.route("/health")
def health():
    return jsonify({"status": "ok", "service": "auth-service"})

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body is required"}), 400

    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Username and password are required"}), 400

    # Mock authentication — in production, query a DB
    valid_users = {
        "admin": "password",
        "student": "devops123",
        "developer": "dev2024"
    }

    if username in valid_users and valid_users[username] == password:
        token = jwt.encode(
            {
                "user": username,
                "role": "admin" if username == "admin" else "user",
                "iat": datetime.datetime.utcnow(),
                "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=8)
            },
            SECRET_KEY,
            algorithm="HS256"
        )
        logger.info(f"User '{username}' logged in successfully")
        return jsonify({
            "token": token,
            "user": username,
            "expires_in": 28800
        })

    logger.warning(f"Failed login attempt for user '{username}'")
    return jsonify({"error": "Invalid credentials"}), 401


@app.route("/verify", methods=["POST"])
def verify():
    auth_header = request.headers.get("Authorization", "")

    # Support 'Bearer <token>' format
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    else:
        token = auth_header

    if not token:
        return jsonify({"valid": False, "error": "No token provided"}), 401

    try:
        decoded = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return jsonify({
            "valid": True,
            "user": decoded["user"],
            "role": decoded.get("role", "user")
        })
    except jwt.ExpiredSignatureError:
        return jsonify({"valid": False, "error": "Token expired"}), 401
    except jwt.InvalidTokenError as e:
        return jsonify({"valid": False, "error": str(e)}), 401


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=4000, debug=False)