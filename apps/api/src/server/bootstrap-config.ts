import { assertTrustProxyConfig } from '@/server/lib/telemetry';

export interface ApiBootstrapConfigInput {
  nodeEnv?: string;
  publicAppUrl?: string;
  trustProxy?: string | boolean;
}

export function assertApiTrustProxyConfig(
  config: ApiBootstrapConfigInput = {
    nodeEnv: process.env.NODE_ENV,
    publicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    trustProxy: process.env.TRUST_PROXY
  }
): void {
  assertTrustProxyConfig(config);
}
