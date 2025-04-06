import {
  toNumber,
  toBoolean,
  convertIds,
  convertIdsInArray,
} from "../utils/converters";

describe("Converter Utility Functions", () => {
  describe("toNumber", () => {
    test("should convert string numeric values to numbers", () => {
      expect(toNumber("123")).toBe(123);
      expect(toNumber("0")).toBe(0);
      expect(toNumber("-10")).toBe(-10);
      expect(toNumber("12.34")).toBe(12.34);
    });

    test("should return number values as is", () => {
      expect(toNumber(123)).toBe(123);
      expect(toNumber(0)).toBe(0);
      expect(toNumber(-10)).toBe(-10);
      expect(toNumber(12.34)).toBe(12.34);
    });

    test("should return null for null or undefined input", () => {
      expect(toNumber(null)).toBeNull();
      expect(toNumber(undefined)).toBeNull();
    });

    test("should return null for non-numeric strings", () => {
      expect(toNumber("abc")).toBeNull();
      expect(toNumber("123abc")).toBeNull();
      expect(toNumber("")).toBeNull();
    });
  });

  describe("toBoolean", () => {
    test("should convert string boolean values to booleans", () => {
      expect(toBoolean("true")).toBe(true);
      expect(toBoolean("false")).toBe(false);
    });

    test("should return boolean values as is", () => {
      expect(toBoolean(true)).toBe(true);
      expect(toBoolean(false)).toBe(false);
    });

    test("should return default value for null or undefined", () => {
      expect(toBoolean(null)).toBe(false);
      expect(toBoolean(undefined)).toBe(false);
      expect(toBoolean(null, true)).toBe(true);
      expect(toBoolean(undefined, true)).toBe(true);
    });

    test("should return default value for non-boolean strings", () => {
      expect(toBoolean("yes")).toBe(false);
      expect(toBoolean("no")).toBe(false);
      expect(toBoolean("1")).toBe(false);
      expect(toBoolean("0")).toBe(false);
      expect(toBoolean("")).toBe(false);

      // With custom default
      expect(toBoolean("yes", true)).toBe(true);
    });
  });

  describe("convertIds", () => {
    test("should convert string IDs to numbers in a record", () => {
      const record = {
        id: "123",
        user_id: "456",
        name: "Test Name",
        active: true,
      };

      const converted = convertIds(record, ["id", "user_id"]);

      expect(converted).toEqual({
        id: 123,
        user_id: 456,
        name: "Test Name",
        active: true,
      });
    });

    test("should handle records with already numeric IDs", () => {
      const record = {
        id: 123,
        user_id: 456,
        name: "Test Name",
      };

      const converted = convertIds(record, ["id", "user_id"]);

      expect(converted).toEqual({
        id: 123,
        user_id: 456,
        name: "Test Name",
      });
    });

    test("should convert null ID values to null", () => {
      const record = {
        id: "123",
        user_id: null,
        name: "Test Name",
      };

      const converted = convertIds(record, ["id", "user_id"]);

      expect(converted).toEqual({
        id: 123,
        user_id: null,
        name: "Test Name",
      });
    });

    test("should handle empty ID fields array", () => {
      const record = {
        id: "123",
        user_id: "456",
        name: "Test Name",
      };

      const converted = convertIds(record, []);

      expect(converted).toEqual({
        id: "123",
        user_id: "456",
        name: "Test Name",
      });
    });

    test("should handle ID fields that do not exist in the record", () => {
      const record = {
        id: "123",
        name: "Test Name",
      };

      const converted = convertIds(record, ["id", "user_id", "nonexistent_id"]);

      expect(converted).toEqual({
        id: 123,
        name: "Test Name",
      });
    });
  });

  describe("convertIdsInArray", () => {
    test("should convert string IDs to numbers in an array of records", () => {
      const records = [
        { id: "123", user_id: "456", name: "Record 1" },
        { id: "789", user_id: "101", name: "Record 2" },
      ];

      const converted = convertIdsInArray(records, ["id", "user_id"]);

      expect(converted).toEqual([
        { id: 123, user_id: 456, name: "Record 1" },
        { id: 789, user_id: 101, name: "Record 2" },
      ]);
    });

    test("should handle an empty array", () => {
      const records: any[] = [];

      const converted = convertIdsInArray(records, ["id", "user_id"]);

      expect(converted).toEqual([]);
    });

    test("should handle mixed record types in the array", () => {
      const records = [
        { id: "123", name: "Record 1" },
        { id: 456, user_id: "789", name: "Record 2" },
        { user_id: "101", name: "Record 3" },
      ];

      const converted = convertIdsInArray(records, ["id", "user_id"]);

      expect(converted).toEqual([
        { id: 123, name: "Record 1" },
        { id: 456, user_id: 789, name: "Record 2" },
        { user_id: 101, name: "Record 3" },
      ]);
    });
  });
});
