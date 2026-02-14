// src/server/services/qr.utils.ts
// Pure validation utilities for QR codes — no side-effect imports.
// Separated to avoid Bun parallel test runner module resolution issues.

export type QRFormat = 'png' | 'svg';
export type QRSize = 100 | 200 | 300 | 500 | 1000;

/**
 * Validate QR code size
 * @param size - Requested size
 * @returns Validated size or default
 */
export function validateQRSize(size: number): QRSize {
  const validSizes: QRSize[] = [100, 200, 300, 500, 1000];

  if (validSizes.includes(size as QRSize)) {
    return size as QRSize;
  }

  // Return the closest valid size
  return validSizes.reduce((prev, curr) =>
    Math.abs(curr - size) < Math.abs(prev - size) ? curr : prev
  );
}

/**
 * Validate QR code format
 * @param format - Requested format
 * @returns Validated format or default
 */
export function validateQRFormat(format: string): QRFormat {
  return format === 'svg' ? 'svg' : 'png';
}
