import { check, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const SHORT_CODE = __ENV.SHORT_CODE || 'example';
const EXPECTED_STATUS = Number(__ENV.EXPECTED_STATUS || '302');
const EXPECTED_LOCATION_PREFIX = __ENV.EXPECTED_LOCATION_PREFIX || 'https://';
const SLEEP_MS = Number(__ENV.SLEEP_MS || '200');

const redirectLatency = new Trend('urlfy_redirect_latency', true);
const redirectSuccessRate = new Rate('urlfy_redirect_success_rate');
const cacheHitRate = new Rate('urlfy_redirect_cache_hit_rate');
const unexpectedStatusCount = new Counter(
  'urlfy_redirect_unexpected_status_total'
);

export const options = {
  scenarios: {
    warm_redirects: {
      executor: 'ramping-vus',
      stages: [
        { duration: '15s', target: 10 },
        { duration: '45s', target: 25 },
        { duration: '15s', target: 0 }
      ],
      gracefulRampDown: '5s'
    }
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200', 'p(99)<300'],
    urlfy_redirect_success_rate: ['rate>0.99'],
    urlfy_redirect_cache_hit_rate: ['rate>0.70']
  }
};

export function setup() {
  return {
    url: `${BASE_URL.replace(/\/$/, '')}/${SHORT_CODE}`
  };
}

export default function (data) {
  const response = http.get(data.url, {
    redirects: 0,
    headers: {
      'User-Agent': 'k6-urlfy-redirect/1.0',
      'X-Request-Id': `k6-${__VU}-${__ITER}`
    },
    tags: {
      route: 'redirect-hot-path'
    }
  });

  redirectLatency.add(response.timings.duration);

  const cacheStatus = response.headers['X-Cache-Status'];
  const redirectLocation =
    response.headers.Location || response.headers.location;

  const ok = check(response, {
    'status matches redirect expectation': (res) =>
      res.status === EXPECTED_STATUS,
    'location header present': () => typeof redirectLocation === 'string',
    'location prefix matches expectation': () =>
      typeof redirectLocation === 'string' &&
      redirectLocation.startsWith(EXPECTED_LOCATION_PREFIX),
    'request id returned': (res) => Boolean(res.headers['X-Request-Id'])
  });

  redirectSuccessRate.add(ok);
  cacheHitRate.add(cacheStatus === 'HIT');

  if (response.status !== EXPECTED_STATUS) {
    unexpectedStatusCount.add(1);
  }

  sleep(SLEEP_MS / 1000);
}
