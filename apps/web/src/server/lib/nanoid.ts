// src/server/lib/nanoid.ts
import { customAlphabet } from 'nanoid';

// Charset: 0-9, a-z, A-Z (62 characters)
const ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const CODE_LENGTH = 7;

// 62^7 = ~3.5 trillion combinations
export const generateShortCode = customAlphabet(ALPHABET, CODE_LENGTH);
