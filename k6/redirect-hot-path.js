import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  scenarios: {
    warm_cache_redirects: {
      executor: 'constant-vus',
      vus: Number(__ENV.K6_VUS ?? 20),
      duration: __ENV.K6_DURATION ?? '30s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.001'],
    http_req_duration: ['p(50)<30', 'p(99)<300']
  }
};

const BASE_URL = __ENV.BASE_URL ?? 'http://localhost:3000';
const SHORT_CODE = __ENV.SHORT_CODE ?? 'abc123';

export default function redirectHotPath() {
  const response = http.get(`${BASE_URL}/r/${SHORT_CODE}`, {
    redirects: 0,
    tags: { surface: 'redirect-hot-path' }
  });

  check(response, {
    'returns a redirect': (res) => res.status === 301 || res.status === 302,
    'has request id': (res) => Boolean(res.headers['X-Request-Id'])
  });

  sleep(1);
}
