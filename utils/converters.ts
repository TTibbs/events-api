/**
 * Utility functions for data type conversions
 */

/**
 * Converts a value to a number, handling null and NaN cases
 * @param value - The value to convert (string, number, or null)
 * @returns The converted number or null if value is null or NaN
 */
export const toNumber = (
  value: string | number | null | undefined
): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
};

/**
 * Converts a value to a boolean
 * @param value - The value to convert
 * @returns The converted boolean value or default if not convertible
 */
export const toBoolean = (
  value: string | boolean | null | undefined,
  defaultValue = false
): boolean => {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
};

/**
 * Converts database ID fields from strings to numbers
 * @param record - Database record with potentially string IDs
 * @param idFields - Array of ID field names to convert
 * @returns Record with converted ID fields
 */
export const convertIds = <T extends Record<string, any>>(
  record: T,
  idFields: string[]
): T => {
  const result = { ...record } as T;
  idFields.forEach((field) => {
    if (field in result) {
      (result as any)[field] = toNumber(result[field as keyof T]);
    }
  });
  return result;
};

/**
 * Converts database ID fields from strings to numbers for an array of records
 * @param records - Array of database records
 * @param idFields - Array of ID field names to convert
 * @returns Array of records with converted ID fields
 */
export const convertIdsInArray = <T extends Record<string, any>>(
  records: T[],
  idFields: string[]
): T[] => {
  return records.map((record) => convertIds(record, idFields));
};
