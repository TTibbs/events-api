import crypto from "crypto";

/**
 * Generates a unique code for ticket identification
 * @returns A unique alphanumeric code
 */
export function generateUniqueCode(): string {
  // Generate a random bytes buffer
  const buffer = crypto.randomBytes(16);

  // Convert to a hex string and make uppercase for better readability
  return buffer.toString("hex").toUpperCase();
}
