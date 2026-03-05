'use client';

import { createContext, type ReactNode, useContext } from 'react';

const NonceContext = createContext<string | undefined>(undefined);

/**
 * CSP Nonce Provider
 * Provides the per-request nonce value to client components
 * that need to use inline scripts (e.g., third-party widgets)
 *
 * @example
 * ```tsx
 * // In layout.tsx
 * <CspNonceProvider nonce={nonce}>
 *   {children}
 * </CspNonceProvider>
 *
 * // In component
 * const nonce = useCspNonce();
 * <script nonce={nonce}>...</script>
 * ```
 */
export function CspNonceProvider({
  nonce,
  children
}: {
  nonce: string;
  children: ReactNode;
}) {
  return (
    <NonceContext.Provider value={nonce}>{children}</NonceContext.Provider>
  );
}

/**
 * Hook to access the CSP nonce in client components
 * @throws {Error} If used outside of CspNonceProvider
 */
export function useCspNonce(): string {
  const nonce = useContext(NonceContext);
  if (!nonce) {
    throw new Error('useCspNonce must be used within CspNonceProvider');
  }
  return nonce;
}
