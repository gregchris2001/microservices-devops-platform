import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const errorRate = new Rate('error_rate');
const apiDuration = new Trend('api_response_time', true);
const successCount = new Counter('successful_requests');

// ─── Load Test Configuration ──────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m',  target: 50 },   // Stay at 50 users for 1 minute
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '1m',  target: 100 },  // Stay at 100 users
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% of requests under 500ms
    http_req_failed: ['rate<0.05'],                   // Error rate below 5%
    error_rate: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

// ─── Test Data ────────────────────────────────────────────────────────────────
const testUsers = [
  'LoadUser_Alpha',
  'LoadUser_Beta',
  'LoadUser_Gamma',
  'LoadUser_Delta',
  'LoadUser_Epsilon',
];

// ─── Test Scenarios ───────────────────────────────────────────────────────────
export default function () {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    const success = check(res, {
      'health status is 200': (r) => r.status === 200,
      'health response is ok': (r) => r.json().status === 'ok',
    });
    errorRate.add(!success);
    if (success) successCount.add(1);
    apiDuration.add(res.timings.duration);
  });

  sleep(0.5);

  group('Get Users', () => {
    const res = http.get(`${BASE_URL}/users`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const success = check(res, {
      'get users status 200': (r) => r.status === 200,
      'get users returns array': (r) => Array.isArray(r.json()),
      'response time < 500ms': (r) => r.timings.duration < 500,
    });
    errorRate.add(!success);
    if (success) successCount.add(1);
    apiDuration.add(res.timings.duration);
  });

  sleep(0.5);

  group('Create User', () => {
    const userName = testUsers[Math.floor(Math.random() * testUsers.length)];
    const payload = JSON.stringify({ name: `${userName}_${Date.now()}` });
    const params = { headers: { 'Content-Type': 'application/json' } };

    const res = http.post(`${BASE_URL}/users`, payload, params);
    const success = check(res, {
      'create user status 200': (r) => r.status === 200,
      'created user has id': (r) => r.json().id !== undefined,
      'response time < 800ms': (r) => r.timings.duration < 800,
    });
    errorRate.add(!success);
    if (success) successCount.add(1);
    apiDuration.add(res.timings.duration);
  });

  sleep(0.5);

  group('Enqueue Job', () => {
    const payload = JSON.stringify({ job: `load-test-job-${Date.now()}` });
    const params = { headers: { 'Content-Type': 'application/json' } };

    const res = http.post(`${BASE_URL}/jobs`, payload, params);
    const success = check(res, {
      'enqueue job status 200': (r) => r.status === 200,
      'job was queued': (r) => r.json().queued === true,
    });
    errorRate.add(!success);
    if (success) successCount.add(1);
    apiDuration.add(res.timings.duration);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: `
╔══════════════════════════════════════════════╗
║     API Load Test Summary                    ║
╠══════════════════════════════════════════════╣
║  Total Requests: ${data.metrics.http_reqs.values.count}
║  Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
║  p50 Latency: ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}ms
║  p95 Latency: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
║  p99 Latency: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms
╚══════════════════════════════════════════════╝
`,
  };
}
