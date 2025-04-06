/**
 * Utility functions for standardized error handling
 */

/**
 * Standard error structure for API responses
 */
export interface ApiError {
  status: number;
  msg: string;
  detail?: string;
  errors?: string[];
}

/**
 * Creates a standardized 404 Not Found error
 * @param entity - The entity type that was not found (e.g., "User", "Event")
 * @param id - The ID that was searched for
 * @returns A standard API error object
 */
export const createNotFoundError = (
  entity: string,
  id?: string | number
): ApiError => {
  return {
    status: 404,
    msg: `${entity} not found`,
  };
};

/**
 * Creates a standardized 400 Bad Request error
 * @param message - The error message
 * @param errors - Optional array of specific validation errors
 * @returns A standard API error object
 */
export const createBadRequestError = (
  message: string,
  errors?: string[]
): ApiError => {
  return {
    status: 400,
    msg: message,
    errors: errors,
  };
};

/**
 * Creates a standardized 401 Unauthorized error
 * @param message - The error message
 * @returns A standard API error object
 */
export const createUnauthorizedError = (message = "Unauthorized"): ApiError => {
  return {
    status: 401,
    msg: message,
  };
};

/**
 * Creates a standardized 403 Forbidden error
 * @param message - The error message
 * @returns A standard API error object
 */
export const createForbiddenError = (message = "Forbidden"): ApiError => {
  return {
    status: 403,
    msg: message,
  };
};

/**
 * Creates a standardized 409 Conflict error
 * @param message - The error message
 * @returns A standard API error object
 */
export const createConflictError = (message: string): ApiError => {
  return {
    status: 409,
    msg: message,
  };
};

/**
 * Helper function to handle missing required fields
 * @param fields - Object of field names and their values
 * @returns An ApiError if any required fields are missing, undefined otherwise
 */
export const validateRequiredFields = (
  fields: Record<string, any>
): ApiError | undefined => {
  const missingFields = Object.entries(fields)
    .filter(
      ([_, value]) => value === undefined || value === null || value === ""
    )
    .map(([key]) => `${key} is required`);

  if (missingFields.length > 0) {
    return {
      status: 400,
      msg:
        missingFields.length === 1
          ? missingFields[0]
          : "Missing required fields",
      errors: missingFields,
    };
  }

  return undefined;
};
