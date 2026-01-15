// tests/load/redirect-simple.js

/**
 * Simple k6 load test for redirect engine
 * Usage: k6 run tests/load/redirect-simple.js
 */

import { check, sleep } from 'k6';
import http from 'k6/http';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '30s', target: 100 }, // Ramp-up
    { duration: '1m', target: 500 }, // Sustained load
    { duration: '30s', target: 0 } // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(50)<30', 'p(99)<300'], // PRD SLOs
    http_req_failed: ['rate<0.01'] // < 1% errors
  }
};

// Test links (should be pre-created)
const TEST_LINKS = ['test001', 'test002', 'test003'];

export default function () {
  const code = TEST_LINKS[Math.floor(Math.random() * TEST_LINKS.length)];

  const res = http.get(`${BASE_URL}/${code}`, {
    redirects: 0 // Don't follow redirects
  });

  check(res, {
    'is redirect': (r) => r.status === 301 || r.status === 302,
    'has location': (r) => r.headers.Location !== undefined
  });

  sleep(0.1);
}
