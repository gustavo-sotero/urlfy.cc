// tests/load/redirect-scenarios.js

import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';
import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

// ═══════════════════════════════════════════════════════════════════
// CUSTOM METRICS
// ═══════════════════════════════════════════════════════════════════

const redirectLatency = new Trend('redirect_latency');
const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');
const errorRate = new Rate('error_rate');
const notFoundRate = new Rate('not_found_rate');
const successRate = new Rate('success_rate');

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  scenarios: {
    // Cenário 1: Carga constante (baseline)
    constant_load: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      tags: { scenario: 'constant' },
      exec: 'constantLoad'
    },

    // Cenário 2: Ramp-up gradual (teste de capacidade)
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },
        { duration: '2m', target: 500 },
        { duration: '1m', target: 1000 },
        { duration: '2m', target: 1000 },
        { duration: '1m', target: 0 }
      ],
      tags: { scenario: 'ramp' },
      exec: 'rampUp'
    },

    // Cenário 3: Spike test (pico repentino)
    spike: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 500,
      maxVUs: 2000,
      stages: [
        { duration: '30s', target: 100 },
        { duration: '10s', target: 2000 }, // Spike!
        { duration: '1m', target: 2000 },
        { duration: '30s', target: 100 }
      ],
      tags: { scenario: 'spike' },
      exec: 'spikeTest'
    },

    // Cenário 4: Soak test (estabilidade de longo prazo)
    soak: {
      executor: 'constant-arrival-rate',
      rate: 200,
      timeUnit: '1s',
      duration: '10m',
      preAllocatedVUs: 100,
      maxVUs: 200,
      tags: { scenario: 'soak' },
      exec: 'soakTest'
    },

    // Cenário 5: Stress test (encontrar limites)
    stress: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 1000,
      maxVUs: 5000,
      stages: [
        { duration: '2m', target: 500 },
        { duration: '2m', target: 1000 },
        { duration: '2m', target: 2000 },
        { duration: '2m', target: 3000 },
        { duration: '2m', target: 4000 },
        { duration: '1m', target: 0 }
      ],
      tags: { scenario: 'stress' },
      exec: 'stressTest'
    }
  },

  // Thresholds (SLOs do PRD)
  thresholds: {
    // Latência P50 < 30ms e P99 < 300ms
    'redirect_latency{scenario:constant}': ['p(50)<30', 'p(99)<300'],
    // Taxa de erro < 0.1%
    error_rate: ['rate<0.001'],
    // Taxa de sucesso > 99.9%
    success_rate: ['rate>0.999'],
    // HTTP req duration
    http_req_duration: ['p(50)<30', 'p(95)<200', 'p(99)<300'],
    // Taxa de falha < 1%
    http_req_failed: ['rate<0.01']
  }
};

// ═══════════════════════════════════════════════════════════════════
// TEST DATA
// ═══════════════════════════════════════════════════════════════════

// Links de teste (devem ser pré-criados no ambiente)
const TEST_LINKS = [
  'test001',
  'test002',
  'test003',
  'test004',
  'test005',
  'test006',
  'test007',
  'test008',
  'test009',
  'test010'
];

// Link para teste de viralidade (spike)
const VIRAL_LINK = 'viral-test';

// Links inexistentes (teste de cache negativo)
const NON_EXISTENT_LINKS = ['notfound1', 'notfound2', 'notfound3'];

// ═══════════════════════════════════════════════════════════════════
// SCENARIO FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

export function constantLoad() {
  const code = TEST_LINKS[randomIntBetween(0, TEST_LINKS.length - 1)];
  performRedirect(code);
}

export function rampUp() {
  const code = TEST_LINKS[randomIntBetween(0, TEST_LINKS.length - 1)];
  performRedirect(code);
}

export function spikeTest() {
  // Durante spike, foca em um único link (simula viralização)
  performRedirect(VIRAL_LINK);
}

export function soakTest() {
  const code = TEST_LINKS[randomIntBetween(0, TEST_LINKS.length - 1)];
  performRedirect(code);
  sleep(0.1); // Menor taxa para soak
}

export function stressTest() {
  const code = TEST_LINKS[randomIntBetween(0, TEST_LINKS.length - 1)];
  performRedirect(code);
}

// ═══════════════════════════════════════════════════════════════════
// REDIRECT TESTING
// ═══════════════════════════════════════════════════════════════════

function performRedirect(code) {
  const startTime = Date.now();

  const res = http.get(`${BASE_URL}/${code}`, {
    redirects: 0, // Não seguir redirects
    tags: { name: 'redirect' },
    headers: {
      'User-Agent': 'k6-load-test/1.0',
      Accept: '*/*'
    }
  });

  const latency = Date.now() - startTime;
  redirectLatency.add(latency);

  // Check cache hit via custom header (if implemented)
  const cacheStatus = res.headers['X-Cache-Status'];
  if (cacheStatus === 'HIT') {
    cacheHits.add(1);
  } else if (cacheStatus === 'MISS') {
    cacheMisses.add(1);
  }

  // Validations
  const success = check(res, {
    'is redirect': (r) => r.status === 301 || r.status === 302,
    'has location': (r) => r.headers.Location !== undefined,
    'has request-id': (r) => r.headers['X-Request-Id'] !== undefined,
    'latency within SLO': () => latency < 300
  });

  if (success) {
    successRate.add(1);
    errorRate.add(0);
  } else {
    successRate.add(0);
    errorRate.add(1);
  }

  if (
    res.status === 404 ||
    (res.status === 302 && res.headers.Location?.includes('/404'))
  ) {
    notFoundRate.add(1);
  } else {
    notFoundRate.add(0);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ADDITIONAL TEST SCENARIOS
// ═══════════════════════════════════════════════════════════════════

export function testNotFound() {
  group('Not Found Handling', () => {
    const code =
      NON_EXISTENT_LINKS[randomIntBetween(0, NON_EXISTENT_LINKS.length - 1)];

    const res = http.get(`${BASE_URL}/${code}`, {
      redirects: 0,
      tags: { name: 'not_found' }
    });

    check(res, {
      'returns 302 to 404 page': (r) => r.status === 302,
      'location is 404': (r) => r.headers.Location?.includes('/404'),
      'has error code header': (r) => r.headers['X-Error-Code'] === 'NOT_FOUND'
    });
  });
}

export function testProtectedLink() {
  group('Password Protected Link', () => {
    const res = http.get(`${BASE_URL}/protected`, {
      redirects: 0,
      tags: { name: 'password_protected' }
    });

    check(res, {
      'redirects to unlock page': (r) => r.status === 302,
      'location is unlock': (r) => r.headers.Location?.includes('/unlock/'),
      'has error code': (r) => r.headers['X-Error-Code'] === 'PASSWORD_REQUIRED'
    });
  });
}

export function testRedirectLoop() {
  group('Redirect Loop Detection', () => {
    const res = http.get(`${BASE_URL}/test001`, {
      redirects: 0,
      tags: { name: 'redirect_loop' },
      headers: {
        'X-Redirect-Depth': '3' // Simula profundidade máxima
      }
    });

    check(res, {
      'returns 421': (r) => r.status === 421,
      'has error code': (r) => r.headers['X-Error-Code'] === 'REDIRECT_LOOP'
    });
  });
}

export function testCacheNegative() {
  group('Negative Cache', () => {
    const code = 'definitely-does-not-exist-123';

    // Primeira request (cache miss)
    http.get(`${BASE_URL}/${code}`, {
      redirects: 0,
      tags: { name: 'negative_cache_miss' }
    });

    // Segunda request (deve usar cache negativo)
    const startTime = Date.now();
    const res2 = http.get(`${BASE_URL}/${code}`, {
      redirects: 0,
      tags: { name: 'negative_cache_hit' }
    });
    const latency = Date.now() - startTime;

    check(res2, {
      'still returns not found': (r) =>
        r.status === 302 && r.headers.Location?.includes('/404'),
      'faster than first': () => latency < 10 // Cache negativo deve ser muito rápido
    });
  });
}

export function testConcurrentAccess() {
  group('Concurrent Access (Stampede Protection)', () => {
    // Simula múltiplas requests simultâneas para o mesmo link
    const code = TEST_LINKS[0];
    const requests = [];

    for (let i = 0; i < 10; i++) {
      requests.push(
        http.get(`${BASE_URL}/${code}`, {
          redirects: 0,
          tags: { name: 'concurrent' }
        })
      );
    }

    // Todas devem ter sucesso
    requests.forEach((res, index) => {
      check(res, {
        [`request ${index + 1} succeeded`]: (r) =>
          r.status === 301 || r.status === 302
      });
    });
  });
}

// ═══════════════════════════════════════════════════════════════════
// SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════

export function setup() {
  console.log('🚀 Starting load test...');
  console.log(`📊 Base URL: ${BASE_URL}`);
  console.log(`🔗 Test links: ${TEST_LINKS.length}`);

  // Warm-up: pre-populate cache
  console.log('🔥 Warming up cache...');
  TEST_LINKS.forEach((code) => {
    http.get(`${BASE_URL}/${code}`, { redirects: 0 });
  });

  console.log('✅ Setup complete');
}

export function teardown(_data) {
  console.log('🏁 Load test completed');
  console.log('📈 Check results in k6 output or Grafana');
}

// ═══════════════════════════════════════════════════════════════════
// CUSTOM SUMMARY
// ═══════════════════════════════════════════════════════════════════

export function handleSummary(data) {
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results/summary.json': JSON.stringify(data),
    'tests/load/results/summary.html': htmlReport(data)
  };
}

function textSummary(data, options) {
  const indent = options?.indent || '';

  let summary = `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  summary += `${indent}  Redirect Engine Load Test Results\n`;
  summary += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // Key metrics
  const metrics = data.metrics;
  if (metrics.redirect_latency) {
    summary += `${indent}Redirect Latency:\n`;
    summary += `${indent}  P50: ${metrics.redirect_latency.values[
      'p(50)'
    ]?.toFixed(2)}ms\n`;
    summary += `${indent}  P95: ${metrics.redirect_latency.values[
      'p(95)'
    ]?.toFixed(2)}ms\n`;
    summary += `${indent}  P99: ${metrics.redirect_latency.values[
      'p(99)'
    ]?.toFixed(2)}ms\n\n`;
  }

  if (metrics.success_rate) {
    const successRate = (metrics.success_rate.values.rate * 100).toFixed(2);
    summary += `${indent}Success Rate: ${successRate}%\n`;
  }

  if (metrics.error_rate) {
    const errorRate = (metrics.error_rate.values.rate * 100).toFixed(4);
    summary += `${indent}Error Rate: ${errorRate}%\n\n`;
  }

  summary += `${indent}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  return summary;
}

function htmlReport(data) {
  const metrics = data.metrics;

  // Calculate key stats
  const latencyP50 =
    metrics.redirect_latency?.values['p(50)']?.toFixed(2) || 'N/A';
  const latencyP99 =
    metrics.redirect_latency?.values['p(99)']?.toFixed(2) || 'N/A';
  const successRate = ((metrics.success_rate?.values.rate || 0) * 100).toFixed(
    2
  );
  const errorRate = ((metrics.error_rate?.values.rate || 0) * 100).toFixed(4);
  const totalRequests = metrics.http_reqs?.values.count || 0;

  return `
<!DOCTYPE html>
<html>
<head>
  <title>k6 Load Test Report - Redirect Engine</title>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h1 {
      color: #333;
      border-bottom: 3px solid #4CAF50;
      padding-bottom: 10px;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 30px 0;
    }
    .metric-card {
      background: #f9f9f9;
      padding: 20px;
      border-radius: 6px;
      border-left: 4px solid #4CAF50;
    }
    .metric-card h3 {
      margin: 0 0 10px 0;
      color: #666;
      font-size: 14px;
      text-transform: uppercase;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    .metric-unit {
      font-size: 16px;
      color: #888;
      margin-left: 5px;
    }
    .pass { color: #4CAF50; }
    .fail { color: #f44336; }
    .warn { color: #ff9800; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #ddd;
    }
    th {
      background: #4CAF50;
      color: white;
      font-weight: 600;
    }
    tr:hover {
      background: #f5f5f5;
    }
    .timestamp {
      color: #888;
      font-size: 14px;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 k6 Load Test Report - Redirect Engine</h1>
    
    <div class="metrics-grid">
      <div class="metric-card">
        <h3>Latency P50</h3>
        <div class="metric-value ${latencyP50 < 30 ? 'pass' : 'fail'}">
          ${latencyP50}<span class="metric-unit">ms</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h3>Latency P99</h3>
        <div class="metric-value ${latencyP99 < 300 ? 'pass' : 'fail'}">
          ${latencyP99}<span class="metric-unit">ms</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h3>Success Rate</h3>
        <div class="metric-value ${successRate > 99.9 ? 'pass' : 'fail'}">
          ${successRate}<span class="metric-unit">%</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h3>Error Rate</h3>
        <div class="metric-value ${errorRate < 0.1 ? 'pass' : 'fail'}">
          ${errorRate}<span class="metric-unit">%</span>
        </div>
      </div>
      
      <div class="metric-card">
        <h3>Total Requests</h3>
        <div class="metric-value">
          ${totalRequests.toLocaleString()}
        </div>
      </div>
    </div>
    
    <h2>All Metrics</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${Object.keys(metrics)
          .map((key) => {
            const metric = metrics[key];
            return `
            <tr>
              <td><strong>${key}</strong></td>
              <td><pre>${JSON.stringify(metric.values, null, 2)}</pre></td>
              <td>-</td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>
    
    <div class="timestamp">
      Generated: ${new Date().toISOString()}
    </div>
  </div>
</body>
</html>
  `;
}
