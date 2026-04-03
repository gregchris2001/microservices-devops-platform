import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ─── Custom Metrics ───────────────────────────────────────────────────────────
const authErrorRate = new Rate('auth_error_rate');
const authDuration = new Trend('auth_response_time', true);
const loginSuccess = new Counter('login_successes');
const loginFailure = new Counter('login_failures');

// ─── Load Test Configuration ──────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '20s', target: 20 },   // Ramp to 20 concurrent auth users
    { duration: '1m',  target: 50 },   // Sustained 50 users
    { duration: '30s', target: 200 },  // High spike — auth DDoS simulation
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<300', 'p(99)<600'],
    http_req_failed: ['rate<0.05'],
    auth_error_rate: ['rate<0.05'],
  },
};

const AUTH_URL = __ENV.AUTH_URL || 'http://localhost:4000';

const validCredentials = [
  { username: 'admin', password: 'password' },
  { username: 'student', password: 'devops123' },
  { username: 'developer', password: 'dev2024' },
];

const invalidCredentials = [
  { username: 'hacker', password: 'wrongpass' },
  { username: 'admin', password: 'incorrect' },
];

export default function () {
  group('Auth Health Check', () => {
    const res = http.get(`${AUTH_URL}/health`);
    check(res, {
      'auth health is 200': (r) => r.status === 200,
      'auth service is ok': (r) => r.json().status === 'ok',
    });
    authDuration.add(res.timings.duration);
  });

  sleep(0.3);

  group('Valid Login', () => {
    const creds = validCredentials[Math.floor(Math.random() * validCredentials.length)];
    const payload = JSON.stringify(creds);
    const params = { headers: { 'Content-Type': 'application/json' } };

    const res = http.post(`${AUTH_URL}/login`, payload, params);
    const success = check(res, {
      'valid login returns 200': (r) => r.status === 200,
      'response has token': (r) => r.json().token !== undefined,
      'response time < 300ms': (r) => r.timings.duration < 300,
    });

    if (success) {
      loginSuccess.add(1);

      // Use token to verify
      const token = res.json('token');
      const verifyRes = http.post(`${AUTH_URL}/verify`, null, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      check(verifyRes, {
        'token verify returns 200': (r) => r.status === 200,
        'token is valid': (r) => r.json().valid === true,
      });
    } else {
      loginFailure.add(1);
    }

    authErrorRate.add(!success);
    authDuration.add(res.timings.duration);
  });

  sleep(0.3);

  group('Invalid Login', () => {
    const creds = invalidCredentials[Math.floor(Math.random() * invalidCredentials.length)];
    const payload = JSON.stringify(creds);
    const params = { headers: { 'Content-Type': 'application/json' } };

    const res = http.post(`${AUTH_URL}/login`, payload, params);
    const rejectedCorrectly = check(res, {
      'invalid login returns 401': (r) => r.status === 401,
      'error message present': (r) => r.json().error !== undefined,
    });
    authErrorRate.add(!rejectedCorrectly);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    stdout: `
╔══════════════════════════════════════════════╗
║     Auth Service Load Test Summary           ║
╠══════════════════════════════════════════════╣
║  Total Requests: ${data.metrics.http_reqs.values.count}
║  Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
║  p50 Latency: ${data.metrics.http_req_duration.values['p(50)'].toFixed(2)}ms
║  p95 Latency: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
║  Login Successes: ${data.metrics.login_successes?.values?.count || 0}
║  Login Failures: ${data.metrics.login_failures?.values?.count || 0}
╚══════════════════════════════════════════════╝
`,
  };
}
