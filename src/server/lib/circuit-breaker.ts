import { circuitBreakerTrips, createLogger } from './telemetry';

const logger = createLogger('circuit-breaker');

// ═══════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER STATES
// ═══════════════════════════════════════════════════════════════════

enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

// ═══════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER CONFIG
// ═══════════════════════════════════════════════════════════════════

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures to trip
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time in ms before trying again (open -> half-open)
  resetTimeout: number; // Time in ms to reset failure count
  name: string; // Circuit breaker name for logging
}

const DEFAULT_CONFIG: Omit<CircuitBreakerConfig, 'name'> = {
  failureThreshold: 5, // 5 failures
  successThreshold: 2, // 2 successes
  timeout: 30000, // 30 seconds
  resetTimeout: 10000 // 10 seconds
};

// ═══════════════════════════════════════════════════════════════════
// CIRCUIT BREAKER IMPLEMENTATION
// ═══════════════════════════════════════════════════════════════════

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  private lastFailureTime = Date.now();
  private config: CircuitBreakerConfig;

  constructor(config: Partial<CircuitBreakerConfig> & { name: string }) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        logger.warn('Circuit breaker is OPEN, rejecting request', {
          circuit: this.config.name,
          nextAttempt: new Date(this.nextAttempt).toISOString()
        });
        throw new Error(
          `Circuit breaker '${this.config.name}' is OPEN. Service unavailable.`
        );
      }

      // Try to transition to HALF_OPEN
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      logger.info('Circuit breaker transitioning to HALF_OPEN', {
        circuit: this.config.name
      });
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        logger.info('Circuit breaker closed after recovery', {
          circuit: this.config.name
        });
      }
    }

    // Reset failure count if enough time has passed
    if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during test, go back to OPEN
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
      circuitBreakerTrips.add(1, { circuit: this.config.name });
      logger.warn('Circuit breaker reopened after failed test', {
        circuit: this.config.name,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.timeout;
      circuitBreakerTrips.add(1, { circuit: this.config.name });
      logger.error('Circuit breaker opened due to failures', {
        circuit: this.config.name,
        failureCount: this.failureCount,
        threshold: this.config.failureThreshold,
        nextAttempt: new Date(this.nextAttempt).toISOString()
      });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStatus(): string {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      name: this.config.name
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    logger.info('Circuit breaker manually reset', {
      circuit: this.config.name
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// CIRCUIT BREAKERS PARA SERVIÇOS
// ═══════════════════════════════════════════════════════════════════

export const dbCircuitBreaker = new CircuitBreaker({
  name: 'postgresql',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeout: 10000
});

export const redisCircuitBreaker = new CircuitBreaker({
  name: 'redis',
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeout: 10000
});

// ═══════════════════════════════════════════════════════════════════
// HELPER PARA EXECUTAR COM FALLBACK
// ═══════════════════════════════════════════════════════════════════

export async function executeWithFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  breaker: CircuitBreaker
): Promise<T> {
  try {
    return await breaker.execute(primary);
  } catch (error) {
    logger.warn('Primary execution failed, using fallback', {
      circuit: breaker.getStats().name,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return await fallback();
  }
}
