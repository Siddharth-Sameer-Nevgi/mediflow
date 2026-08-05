import bcrypt from "bcryptjs";

/**
 * Server-only password helpers. Only the bcrypt hash is ever persisted —
 * plaintext passwords are never stored or logged.
 */

export const PASSWORD_MIN_LENGTH = 8;

const BCRYPT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
