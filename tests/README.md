# Tests Documentation - urlfy.cc

> 📖 [← Back to Main README](../README.md)

This document provides comprehensive information about the test suite for the urlfy.cc project, with special focus on the **Module 04: Redirect Engine** testing strategy.

---

## 📂 Test Structure

```
tests/
├── integration/              # Integration tests (E2E flows)
│   └── redirect.integration.test.ts
├── load/                     # Performance tests (k6)
│   ├── redirect-simple.js
│   └── redirect-scenarios.js
└── results/                  # Test reports (generated)

src/
├── server/
│   ├── services/__tests__/  # Service unit tests
│   │   ├── redirect.service.test.ts
│   │   ├── cache.service.test.ts
│   │   └── ...
│   └── middleware/__tests__/ # Middleware unit tests
│       ├── redirect.middleware.test.ts
│       └── ...
└── server/lib/__tests__/     # Library unit tests
```

---

## 🧪 Test Types

### 1. Unit Tests

**Location**: `src/**/__tests__/*.test.ts`  
**Runner**: Bun Test  
**Coverage Target**: > 80%

#### Running Unit Tests

```bash
# Run all unit tests
bun test

# Run specific test file
bun test src/server/services/__tests__/redirect.service.test.ts

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test --coverage
```

#### Key Unit Tests

| File                          | Coverage | Critical Scenarios                     |
| ----------------------------- | -------- | -------------------------------------- |
| `redirect.service.test.ts`    | ✅       | Cache hit/miss, validations, errors    |
| `cache.service.test.ts`       | ✅       | CRUD operations, TTL, invalidation     |
| `redirect.middleware.test.ts` | ✅       | Request handling, analytics enqueueing |

#### Example: Redirect Service Test

```typescript
describe('RedirectService', () => {
  it('should return URL for valid active link from cache', async () => {
    const mockLink: CachedLink = {
      id: 'test-id-001',
      originalUrl: 'https://example.com',
      redirectType: 301,
      isActive: true
      // ...
    };

    mockCache.getLink.mockResolvedValue(mockLink);
    const result = await redirectService.resolve('abc123', 0);

    expect(result.success).toBe(true);
    expect(result.url).toBe('https://example.com');
  });
});
```

---

### 2. Integration Tests

**Location**: `tests/integration/*.test.ts`  
**Runner**: Bun Test  
**Requirements**: Running PostgreSQL + Redis (via Docker Compose)

#### Running Integration Tests

```bash
# Start dependencies
docker-compose -f docker/docker-compose.dev.yml up -d postgres redis

# Run integration tests
bun test tests/integration/

# Stop dependencies
docker-compose -f docker/docker-compose.dev.yml down
```

#### Integration Test Scenarios

1. **End-to-End Redirect Flow**

   - First request (cache miss) → PostgreSQL → Cache population
   - Second request (cache hit) → Fast response
   - Validation of cache state

2. **Cache Invalidation**

   - Update link → Cache cleared
   - Next request fetches fresh data

3. **Error Handling**
   - 404 responses
   - Banned links
   - Expired links

#### Example: Integration Test

```typescript
it('should redirect and populate cache on first request', async () => {
  // Verify cache is empty
  const cachedBefore = await cacheService.getLink('int-test-1');
  expect(cachedBefore).toBeNull();

  // First request (cache miss)
  const result = await redirectService.resolve('int-test-1', 0);
  expect(result.success).toBe(true);

  // Verify cache was populated
  const cachedAfter = await cacheService.getLink('int-test-1');
  expect(cachedAfter).not.toBeNull();
});
```

---

### 3. Load Tests (k6)

**Location**: `tests/load/*.js`  
**Runner**: k6  
**Purpose**: Validate performance under load

#### Installation

```bash
# macOS
brew install k6

# Windows (Chocolatey)
choco install k6

# Linux
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

#### Running Load Tests

```bash
# Simple load test (2 minutes)
k6 run tests/load/redirect-simple.js

# Comprehensive scenarios (15+ minutes)
k6 run tests/load/redirect-scenarios.js

# Custom environment
BASE_URL=https://staging.urlfy.cc k6 run tests/load/redirect-simple.js

# Output to InfluxDB (optional)
k6 run --out influxdb=http://localhost:8086/k6 tests/load/redirect-simple.js
```

#### Load Test Scenarios

| Scenario          | Duration | VUs       | Target RPS | Purpose              |
| ----------------- | -------- | --------- | ---------- | -------------------- |
| **Constant Load** | 2m       | 50        | 500        | Baseline performance |
| **Ramp-Up**       | 7m       | 0→1000    | 100→10k    | Capacity testing     |
| **Spike**         | 3m       | 500→2000  | 5k→20k     | Burst handling       |
| **Soak**          | 10m      | 100       | 2k         | Stability testing    |
| **Stress**        | 11m      | 1000→5000 | 10k→50k    | Breaking point       |

#### Performance SLOs (from PRD)

```javascript
thresholds: {
  'redirect_latency': ['p(50)<30', 'p(99)<300'],  // ms
  'http_req_failed': ['rate<0.01'],                // < 1%
  'success_rate': ['rate>0.999'],                  // > 99.9%
}
```

#### Example: k6 Test Output

```
     ✓ is redirect
     ✓ has location
     ✓ latency within SLO

     checks.........................: 100.00% ✓ 150000 ✗ 0
     data_received..................: 45 MB   750 kB/s
     data_sent......................: 15 MB   250 kB/s
     http_req_duration..............: avg=25ms p(50)=18ms p(99)=150ms
     http_reqs......................: 50000   833/s
     redirect_latency...............: avg=22ms p(50)=15ms p(99)=120ms
     success_rate...................: 99.98%
```

---

## 🎯 Test Scenarios Coverage

### Redirect Engine Test Matrix

| Scenario                    | Unit | Integration | Load |
| --------------------------- | ---- | ----------- | ---- |
| **Valid active link**       | ✅   | ✅          | ✅   |
| **Cache hit**               | ✅   | ✅          | ✅   |
| **Cache miss**              | ✅   | ✅          | ✅   |
| **Negative cache (404)**    | ✅   | ✅          | ✅   |
| **Banned link**             | ✅   | ✅          | ⚠️   |
| **Expired link**            | ✅   | ✅          | ⚠️   |
| **Inactive link**           | ✅   | ✅          | ⚠️   |
| **Max clicks reached**      | ✅   | ⚠️          | ⚠️   |
| **Password protected**      | ✅   | ⚠️          | ✅   |
| **Redirect loop (depth 3)** | ✅   | ⚠️          | ✅   |
| **UTM parameters**          | ✅   | ⚠️          | -    |
| **Stampede protection**     | ⚠️   | ⚠️          | ✅   |
| **Circuit breaker**         | ⚠️   | ⚠️          | ⚠️   |
| **Redis fallback**          | ⚠️   | ⚠️          | ⚠️   |

**Legend**: ✅ Fully tested | ⚠️ Partially tested | - Not applicable

---

## 🛠️ Testing Best Practices

### 1. Environment Setup

```bash
# Copy environment template
cp .env.example .env.test

# Set test database URL
export DATABASE_URL="postgresql://test:test@localhost:5432/urlfy_test"
export REDIS_URL="redis://localhost:6379"
export NODE_ENV="test"
```

### 2. Test Data Management

- Use **test-specific prefixes** (`test-*`, `int-test-*`) for isolation
- **Clean up** before and after tests
- **Avoid hardcoded IDs** - generate dynamically

### 3. Mocking Strategy

```typescript
// Mock external dependencies
mock.module('@/server/lib/redis', () => ({
  redis: mockRedis
}));

// But test real logic
// ❌ Don't mock: redirectService itself
// ✅ Do mock: redis, database, external APIs
```

### 4. Async Handling

```typescript
// ✅ Good: Proper async/await
it('should enqueue event', async () => {
  await handleRedirect(request, 'code');
  expect(queue.add).toHaveBeenCalled();
});

// ❌ Bad: Missing await
it('should enqueue event', () => {
  handleRedirect(request, 'code'); // Promise not awaited!
  expect(queue.add).toHaveBeenCalled();
});
```

---

## 📊 Test Reporting

### Code Coverage

```bash
# Generate coverage report
bun test --coverage

# View HTML report
open coverage/index.html
```

**Coverage Targets**:

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

### Load Test Reports

k6 automatically generates:

- **Console output** (real-time)
- **JSON summary** (`tests/load/results/summary.json`)
- **HTML report** (`tests/load/results/summary.html`)

View HTML report:

```bash
open tests/load/results/summary.html
```

---

## 🐛 Debugging Tests

### Enable Debug Logging

```bash
# Unit tests
DEBUG=* bun test

# Integration tests with DB queries
DEBUG=drizzle:* bun test tests/integration/
```

### VS Code Debug Configuration

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Current Test",
  "runtimeExecutable": "bun",
  "runtimeArgs": ["test", "${file}"],
  "console": "integratedTerminal"
}
```

---

## 🚀 CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
      redis:
        image: redis:7-alpine
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test tests/integration/
```

---

## 📚 Additional Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [k6 Documentation](https://k6.io/docs/)
- [Module 04 Specification](../docs/modules/module-04-redirect.md)
- [SigNoz Dashboard](../docker/signoz/dashboards/redirect-engine.json)

---

**Last Updated**: 2026-01-08  
**Maintainer**: DevOps Team
