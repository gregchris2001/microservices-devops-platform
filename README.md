# 🚀 Microservices DevOps Platform

![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=flat&logo=kubernetes&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat&logo=githubactions&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=flat&logo=terraform&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=flat&logo=prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=flat&logo=grafana&logoColor=white)
![ArgoCD](https://img.shields.io/badge/ArgoCD-EF7B4D?style=flat&logo=argo&logoColor=white)

A complete, production-grade **Microservices DevOps Platform** designed to teach students every layer of modern DevOps — from containerization to GitOps, observability to security scanning.

---

## 📐 Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │              Internet / Browser               │
                    └──────────────────┬───────────────────────────┘
                                       │ :8080
                    ┌──────────────────▼───────────────────────────┐
                    │           Frontend (React + Nginx)            │
                    └──────┬─────────────────────┬─────────────────┘
                           │ :3000                │ :4000
              ┌────────────▼────────┐   ┌─────────▼────────────┐
              │    API Service      │   │    Auth Service       │
              │  (Node.js+Express)  │   │   (Python+Flask)      │
              └────┬────────┬───────┘   └──────────────────────┘
                   │        │ 
         ┌─────────▼──┐  ┌──▼──────────┐  ┌───────────────────┐
         │ PostgreSQL  │  │    Redis     │  │  Worker Service   │
         │ (Database)  │  │ (Cache/Queue)│  │   (Python)        │
         └─────────────┘  └─────────────┘  └───────────────────┘
                                       
         ┌──────────────┐  ┌───────────┐  ┌────────────────────┐
         │  Prometheus   │  │  Grafana  │  │   Loki + Promtail  │
         │   (Metrics)   │  │(Dashboards)  │   (Logging)        │
         └──────────────┘  └───────────┘  └────────────────────┘
```

---

## 🔧 Services

| Service | Technology | Port | Description |
|---------|------------|------|-------------|
| **Frontend** | React + Nginx (multi-stage) | 8080 | Dashboard UI with auth, user management, job queue |
| **API Service** | Node.js + Express | 3000 | REST API with PostgreSQL + Redis, Prometheus metrics |
| **Auth Service** | Python + Flask | 4000 | JWT authentication, Prometheus metrics |
| **Worker Service** | Python | — | Redis job queue processor |
| **PostgreSQL** | postgres:15 | 5432 | Primary database |
| **Redis** | redis:7 | 6379 | Cache and job queue |
| **Prometheus** | prom/prometheus | 9090 | Metrics collection |
| **Grafana** | grafana/grafana | 3001 | Visualization dashboards |

---

## 📋 Prerequisites

Install the following tools:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Kubernetes enabled)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Minikube](https://minikube.sigs.k8s.io/) (optional alternative)
- [Helm](https://helm.sh/docs/intro/install/)
- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [k6](https://k6.io/docs/get-started/installation/) (for load testing)
- [ArgoCD CLI](https://argo-cd.readthedocs.io/en/stable/cli_installation/) (optional)

---

## Part 1 — Clone the Repository

```bash
git clone https://github.com/gregchris/microservices-devops-platform.git
cd microservices-devops-platform
```

---

## Part 2 — Run with Docker Compose

### Build and Start All Services

```bash
docker compose up --build
```

### Verify Running Containers

```bash
docker ps
```

### 📸 Screenshot: All containers should show `healthy` status

### Test Each Service

| Service | URL | Expected Response |
|---------|-----|-------------------|
| **Frontend** | http://localhost:8080 | DevOps Dashboard UI |
| **API** | http://localhost:3000/health | `{"status":"ok"}` |
| **Auth** | http://localhost:4000/health | `{"status":"ok"}` |
| **Prometheus** | http://localhost:9090 | Prometheus UI |
| **Grafana** | http://localhost:3001 | Grafana UI |

### Initialize the Database

```bash
curl http://localhost:3000/init
```

### Test Login via Auth Service

```bash
curl -X POST http://localhost:4000/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'
```

Expected: `{"token": "eyJ...", "user": "admin"}`

### Stop All Services

```bash
docker compose down
```

### Bonus — Run with Logging Stack

```bash
docker compose -f docker-compose.yml -f docker-compose.logging.yml up
```

---

## Part 3 — Kubernetes Deployment

### Start Your Kubernetes Cluster

```bash
# Option A: Docker Desktop (enable in settings)
# Option B: Minikube
minikube start
```

### Apply All Manifests

```bash
# Apply in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/
```

### ✅ Testing Checklist

```bash
# ✅ Check all pods are Running
kubectl get pods -n devops-platform

# ✅ Check all services are created
kubectl get svc -n devops-platform

# ✅ Check deployments are ready
kubectl get deployments -n devops-platform

# ✅ Check HPA is working
kubectl get hpa -n devops-platform
```

### 📸 Screenshot: `kubectl get pods -n devops-platform` — all pods should show `Running`

### Access the Frontend

```bash
kubectl port-forward svc/frontend 8080:80 -n devops-platform
```

Open: **http://localhost:8080**

---

## Part 4 — CI/CD Pipeline

The pipeline runs automatically when you push to `main`.

### Required GitHub Secrets

Go to **Settings → Secrets → Actions** and add:

| Secret | Value |
|--------|-------|
| `DOCKER_USERNAME` | `gregchris` |
| `DOCKER_PASSWORD` | Your DockerHub password/token |
| `KUBECONFIG` | Base64-encoded kubeconfig: `cat ~/.kube/config \| base64` |

### Push to Trigger the Pipeline

```bash
git add .
git commit -m "Deploy: update microservices platform"
git push origin main
```

### Pipeline Jobs

```
test-api  ──┐
             ├──► build-and-push ──► security-scan ──► deploy
test-python ─┤
             │
build-frontend
```

### 📸 Screenshot: GitHub Actions tab — all 6 jobs should show green ✅

---

## Part 5 — GitOps with ArgoCD

### Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

### Wait for ArgoCD to Start

```bash
kubectl wait --for=condition=available --timeout=300s deployment/argocd-server -n argocd
```

### Access the ArgoCD UI

```bash
kubectl port-forward svc/argocd-server -n argocd 8081:443
```

Open: **https://localhost:8081** (accept the self-signed cert)

### Get Admin Password

```bash
# Linux/macOS:
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | base64 -d

# Windows PowerShell:
kubectl get secret argocd-initial-admin-secret -n argocd -o jsonpath="{.data.password}" | ForEach-Object { [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($_)) }
```

### Apply the ArgoCD App

```bash
kubectl apply -f k8s/argocd-app.yaml
```

### 📸 Screenshot: ArgoCD UI showing the application as `Synced` and `Healthy`

---

## Part 6 — Monitoring (Prometheus & Grafana)

### Access Monitoring Tools

| Tool | URL | Login |
|------|-----|-------|
| Prometheus | http://localhost:9090 | No login |
| Grafana | http://localhost:3001 | admin / admin |

### Prometheus Targets

Go to **http://localhost:9090/targets** — verify all targets show `UP`:
- `api-service`
- `auth-service`

### 📸 Screenshot: Prometheus targets page with all targets showing `UP` (green)

### Grafana Dashboard

Grafana is **pre-configured** with:
- Prometheus datasource auto-provisioned
- "Microservices DevOps Platform" dashboard auto-loaded

Go to **http://localhost:3001** → Dashboards → "Microservices DevOps Platform"

### 📸 Screenshot: Grafana dashboard showing service health, request rates, and latency panels

---

## Part 7 — Terraform Infrastructure

### Configure AWS CLI

```bash
aws configure
# Enter: Access Key, Secret Key, Region (us-east-1), Output format (json)
```

### Initialize and Plan

```bash
cd terraform
terraform init
terraform plan
```

Review the plan — ensure 20-30 resources would be created.

### Apply (Creates EKS Cluster)

```bash
terraform apply -auto-approve
```

> ⚠️ This will create real AWS resources and incur costs. Only run with an active AWS account.

### Configure kubectl for EKS

```bash
# Run the output from terraform:
aws eks update-kubeconfig --region us-east-1 --name microservices-cluster
```

### Destroy Infrastructure (When Done)

```bash
terraform destroy -auto-approve
```

---

## ✅ Testing Checklist

### Docker Compose
- [ ] `docker compose up --build` completes without errors
- [ ] `docker ps` shows all 8 containers as healthy
- [ ] Frontend accessible at http://localhost:8080
- [ ] Login works with admin/password
- [ ] User can be added (appears in list)
- [ ] Job can be enqueued
- [ ] Prometheus shows targets at http://localhost:9090/targets
- [ ] Grafana dashboard visible at http://localhost:3001

### Kubernetes
- [ ] All pods in `Running` state: `kubectl get pods -n devops-platform`
- [ ] All services created: `kubectl get svc -n devops-platform`
- [ ] HPA configured: `kubectl get hpa -n devops-platform`
- [ ] Port-forward to frontend works

### CI/CD
- [ ] GitHub Actions pipeline triggers on push
- [ ] All 6 jobs pass (test-api, test-python, build-frontend, build-and-push, security-scan, deploy)
- [ ] Docker images appear on DockerHub

### ArgoCD (GitOps)
- [ ] ArgoCD UI accessible
- [ ] Application shows `Synced` and `Healthy`

### Monitoring
- [ ] Prometheus targets all `UP`
- [ ] Grafana dashboard loads with data

---

## 🎓 Bonus Work

### Bonus 1 — Centralized Logging (Loki + Promtail)

```bash
docker compose -f docker-compose.yml -f docker-compose.logging.yml up -d
```

In Grafana: **Explore → Select Loki datasource → View container logs**

📸 Screenshot: Grafana Explore with Loki showing container logs

### Bonus 2 — Helm Charts

```bash
# Add Bitnami for dependencies
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update helm/microservices-platform/

# Install with Helm
helm install platform helm/microservices-platform/ -n devops-platform --create-namespace

# Upgrade
helm upgrade platform helm/microservices-platform/ -n devops-platform

# Check status
helm status platform -n devops-platform
```

📸 Screenshot: `helm list -n devops-platform` showing the release as `deployed`

### Bonus 3 — Load Testing (k6)

```bash
# Install k6 (Windows)
choco install k6

# Run API load test
k6 run load-testing/k6/api-load-test.js

# Run Auth load test
k6 run load-testing/k6/auth-load-test.js
```

📸 Screenshot: k6 terminal output showing request stats, p95/p99 latency, and pass/fail thresholds

### Bonus 4 — SSL/HTTPS (cert-manager)

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install nginx-ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Apply issuers (edit your email first!)
kubectl apply -f k8s/cert-manager-issuer.yaml

# Apply TLS ingress
kubectl apply -f k8s/ingress-tls.yaml
```

---

## 🛠️ Troubleshooting

| Problem | Solution |
|---------|----------|
| `docker compose up` fails | Run `docker compose down -v` then `docker compose up --build` |
| Pods stuck in `Pending` | Check: `kubectl describe pod <pod-name> -n devops-platform` |
| API returns 503 | Check postgres health: `kubectl get pods -n devops-platform \| grep postgres` |
| Prometheus targets DOWN | Ensure services expose `/metrics` endpoint |
| ArgoCD won't sync | Check repo URL in `k8s/argocd-app.yaml` matches your GitHub repo |
| Grafana shows no data | Add Prometheus datasource manually at http://localhost:3001/datasources |

---

## 📁 Project Structure

```
microservices-devops-platform/
├── .github/workflows/
│   └── ci-cd.yaml              # 6-job CI/CD pipeline
├── frontend/                   # React + Nginx (multi-stage Docker)
├── api-service/                # Node.js + Express + prom-client
├── auth-service/               # Python + Flask + JWT
├── worker-service/             # Python + Redis consumer
├── k8s/                        # Kubernetes manifests (15+ files)
├── helm/microservices-platform/ # Helm chart (Bonus 2)
├── monitoring/
│   ├── prometheus.yml          # Prometheus scrape config
│   ├── grafana/                # Auto-provisioned datasource + dashboard
│   ├── loki/                   # Loki config (Bonus 1)
│   └── promtail/               # Promtail config (Bonus 1)
├── load-testing/k6/            # k6 load test scripts (Bonus 3)
├── terraform/                  # AWS EKS infrastructure
├── docker-compose.yml          # Main stack
└── docker-compose.logging.yml  # Logging stack (Bonus 1)
```

---

## 👤 Author

**gregchris** · [DockerHub](https://hub.docker.com/u/gregchris) · [GitHub](https://github.com/gregchris)
