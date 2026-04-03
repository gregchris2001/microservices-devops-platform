# 🔥 Load Testing — Microservices DevOps Platform

## Prerequisites

Install [k6](https://k6.io/docs/get-started/installation/):

```bash
# Windows (via Chocolatey)
choco install k6

# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Running the Tests

> ⚠️ Make sure Docker Compose services are running first: `docker compose up -d`

### API Service Load Test

Tests the `/health`, `/users` and `/jobs` endpoints under staged load.

```bash
# Basic run
k6 run load-testing/k6/api-load-test.js

# With custom API URL
k6 run -e API_URL=http://localhost:3000 load-testing/k6/api-load-test.js

# Against Kubernetes (after port-forward)
k6 run -e API_URL=http://localhost:3000 load-testing/k6/api-load-test.js
```

### Auth Service Load Test

Simulates login traffic including valid logins, invalid logins, and token verification.

```bash
# Basic run
k6 run load-testing/k6/auth-load-test.js

# With custom auth URL
k6 run -e AUTH_URL=http://localhost:4000 load-testing/k6/auth-load-test.js
```

### Run Both Tests Simultaneously

```bash
# Terminal 1
k6 run load-testing/k6/api-load-test.js

# Terminal 2
k6 run load-testing/k6/auth-load-test.js
```

## Load Test Stages

| Stage | Duration | Target Users | Purpose |
|-------|----------|--------------|---------|
| Ramp up | 30s | 10 | Warm up |
| Sustained | 60s | 50 | Normal load |
| Spike | 30s | 100 | Peak traffic |
| Sustained peak | 60s | 100 | Stress test |
| Ramp down | 30s | 0 | Cool down |

## Performance Thresholds

| Metric | Threshold |
|--------|-----------|
| p95 response time | < 500ms |
| p99 response time | < 1000ms |
| Error rate | < 5% |

## Understanding Results

```
✓ http_req_duration.......: avg=45ms  p(90)=89ms  p(95)=120ms  p(99)=250ms
✓ http_req_failed.........: 0.00%    ✓
✓ http_reqs...............: 12450    rate=69.7/s
```

- **avg** — Average response time
- **p(95)** — 95th percentile (95% of requests were faster than this)
- **http_req_failed** — Percentage of requests that failed

## Viewing Results in Grafana

You can export k6 results to Prometheus for Grafana visualization:

```bash
# Install k6 prometheus extension or run with output flag:
k6 run --out json=results.json load-testing/k6/api-load-test.js

# Or use k6 cloud (requires k6 account)
k6 cloud load-testing/k6/api-load-test.js
```
