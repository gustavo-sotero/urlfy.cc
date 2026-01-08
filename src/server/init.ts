// Initialize telemetry and validate environment as early as possible
import { validateEnv } from "@/lib/env";
import { initTelemetry } from "@/server/lib/telemetry";
import { initializeWorkers, shutdownWorkers } from "@/server/workers";

// Only initialize in server environment
if (typeof window === "undefined") {
  // Validate environment first
  try {
    validateEnv();
    console.log("✅ Environment variables validated");
  } catch (_error) {
    console.error("❌ Environment validation failed");
    process.exit(1);
  }

  // Initialize telemetry
  initTelemetry();

  // Initialize workers and schedulers
  initializeWorkers().catch((error) => {
    console.error("❌ Failed to initialize workers:", error);
    process.exit(1);
  });

  // Setup graceful shutdown handlers
  setupGracefulShutdown();
}

async function setupGracefulShutdown() {
  const { closeDatabase } = await import("@/db");
  const { closeRedis } = await import("@/server/lib/redis");
  const { shutdownQueues } = await import("@/server/lib/queue");

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Starting graceful shutdown...`);

    try {
      // Shutdown workers first
      await shutdownWorkers();

      // Close connections
      await Promise.all([closeDatabase(), closeRedis(), shutdownQueues()]);

      console.log("✅ Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error during shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
