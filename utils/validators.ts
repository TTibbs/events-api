/**
 * Utility functions for input validation
 */
import { ApiError, createBadRequestError } from "./error-handlers";

/**
 * Validates a numeric ID
 * @param id - The ID to validate
 * @param entityName - Name of the entity being validated for better error messages
 * @returns The validated numeric ID
 * @throws ApiError if the ID is invalid
 */
export const validateId = (id: any, entityName = "Item"): number => {
  const numId = Number(id);
  if (isNaN(numId) || numId <= 0 || !Number.isInteger(numId)) {
    throw createBadRequestError(
      `Invalid ${entityName} ID: must be a positive integer`
    );
  }
  return numId;
};

/**
 * Validates a date string and converts it to a Date object
 * @param dateStr - The date string to validate
 * @param fieldName - Name of the field for error messages
 * @returns The validated Date object
 * @throws ApiError if the date is invalid
 */
export const validateDate = (dateStr: any, fieldName = "Date"): Date => {
  if (!dateStr) {
    throw createBadRequestError(`${fieldName} is required`);
  }

  try {
    const date = new Date(dateStr);

    // Check if date is valid
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date");
    }

    return date;
  } catch (error) {
    throw createBadRequestError(`Invalid ${fieldName} format`);
  }
};

/**
 * Validates that an end date is after a start date
 * @param startDate - The start date to compare
 * @param endDate - The end date to compare
 * @param startFieldName - Name of the start field for error messages
 * @param endFieldName - Name of the end field for error messages
 * @throws ApiError if end date is not after start date
 */
export const validateDateRange = (
  startDate: Date,
  endDate: Date,
  startFieldName = "Start date",
  endFieldName = "End date"
): void => {
  if (endDate <= startDate) {
    throw createBadRequestError(
      `${endFieldName} must be after ${startFieldName}`
    );
  }
};

/**
 * Validates an email address format
 * @param email - The email to validate
 * @returns true if valid, throws error otherwise
 * @throws ApiError if the email is invalid
 */
export const validateEmail = (email: string): boolean => {
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw createBadRequestError("Invalid email format");
  }
  return true;
};

/**
 * Validates a username
 * @param username - The username to validate
 * @param minLength - Minimum length required (default: 3)
 * @param maxLength - Maximum length allowed (default: 30)
 * @returns true if valid, throws error otherwise
 * @throws ApiError if the username is invalid
 */
export const validateUsername = (
  username: string,
  minLength = 3,
  maxLength = 30
): boolean => {
  if (!username) {
    throw createBadRequestError("Username is required");
  }

  if (username.length < minLength || username.length > maxLength) {
    throw createBadRequestError(
      `Username must be between ${minLength} and ${maxLength} characters`
    );
  }

  // Check for valid characters (alphanumeric plus some special chars)
  const usernameRegex = /^[a-zA-Z0-9_.-]+$/;
  if (!usernameRegex.test(username)) {
    throw createBadRequestError(
      "Username can only contain letters, numbers, underscores, dots, and hyphens"
    );
  }

  return true;
};

/**
 * Validates a password
 * @param password - The password to validate
 * @param minLength - Minimum length required (default: 6)
 * @returns true if valid, throws error otherwise
 * @throws ApiError if the password is invalid
 */
export const validatePassword = (password: string, minLength = 6): boolean => {
  if (!password) {
    throw createBadRequestError("Password is required");
  }

  if (password.length < minLength) {
    throw createBadRequestError(
      `Password must be at least ${minLength} characters`
    );
  }

  return true;
};
