export interface BrowserLogPayload {
  error: string;
  url: string;
  componentStack?: string;
  requestId?: string;
  userAgent?: string;
  timestamp?: string;
  context?: Record<string, string | number | boolean | null | undefined>;
}
