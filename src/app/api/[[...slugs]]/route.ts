// Initialize telemetry before API
import { api } from '@/server/api';

// ElysiaJS integration with Next.js App Router
export const GET = api.handle;
export const POST = api.handle;
export const PATCH = api.handle;
export const PUT = api.handle;
export const DELETE = api.handle;
export const OPTIONS = api.handle;
