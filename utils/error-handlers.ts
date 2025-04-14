/**
 * Interface for API errors with status code, message, and optional errors array
 */
export interface ApiError {
  status: number;
  msg: string;
  errors?: string[];
}

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

/**
 * Helper function to validate and convert ID parameters
 * @param id - ID to validate
 * @param entityName - Name of the entity for error messages
 * @returns Validated number ID
 * @throws ApiError if ID is invalid
 */
export const validateId = (id: any, entityName: string): number => {
  const numId = Number(id);
  if (isNaN(numId) || numId <= 0) {
    throw {
      status: 400,
      msg: `Invalid ${entityName} ID`,
    };
  }
  return numId;
};
