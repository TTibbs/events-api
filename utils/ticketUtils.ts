import crypto from "crypto";

/**
 * Generates a unique ticket code with a consistent format
 * Format: 8 character alphanumeric code
 */
export function generateUniqueTicketCode(): string {
  // Generate 4 bytes of random data (which gives us 8 hex characters)
  const randomBytes = crypto.randomBytes(4);

  // Convert to a hex string and uppercase it for better readability
  const ticketCode = randomBytes.toString("hex").toUpperCase();

  return ticketCode;
}

/**
 * Validates a ticket code format
 */
export function isValidTicketCode(code: string): boolean {
  // Ticket code should be 8 characters, all uppercase hex
  const validCodeRegex = /^[0-9A-F]{8}$/;
  return validCodeRegex.test(code);
}
