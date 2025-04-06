import {
  validateId,
  validateDate,
  validateDateRange,
  validateEmail,
  validateUsername,
  validatePassword,
} from "../utils/validators";
import { ApiError } from "../utils/error-handlers";

describe("Validator Utility Functions", () => {
  describe("validateId", () => {
    test("should validate and return a positive integer", () => {
      expect(validateId(123)).toBe(123);
      expect(validateId("456")).toBe(456);
    });

    test("should throw an error for non-numeric values", () => {
      try {
        validateId("abc");
        fail("Expected validateId to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("Invalid Item ID");
      }
    });

    test("should throw an error for non-integer values", () => {
      try {
        validateId(12.34);
        fail("Expected validateId to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("Invalid Item ID");
      }
    });

    test("should throw an error for negative or zero values", () => {
      try {
        validateId(0);
        fail("Expected validateId to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("Invalid Item ID");
      }

      try {
        validateId(-1);
        fail("Expected validateId to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("Invalid Item ID");
      }
    });

    test("should include entity name in error message", () => {
      try {
        validateId("abc", "User");
        fail("Expected validateId to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("Invalid User ID");
      }
    });
  });

  describe("validateDate", () => {
    test("should validate and return a Date object for valid date strings", () => {
      const date = validateDate("2023-05-15");
      expect(date).toBeInstanceOf(Date);
      expect(date.getFullYear()).toBe(2023);
      expect(date.getMonth()).toBe(4); // May is 4 (0-indexed)
      expect(date.getDate()).toBe(15);
    });

    test("should accept ISO date strings", () => {
      const date = validateDate("2023-05-15T14:30:00Z");
      expect(date).toBeInstanceOf(Date);
    });

    test("should accept Date objects", () => {
      const inputDate = new Date(2023, 4, 15);
      const resultDate = validateDate(inputDate);
      expect(resultDate).toBeInstanceOf(Date);
      expect(resultDate.getTime()).toBe(inputDate.getTime());
    });

    test("should throw an error for missing dates", () => {
      try {
        validateDate(null);
        fail("Expected validateDate to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("required");
      }

      try {
        validateDate(undefined);
        fail("Expected validateDate to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("required");
      }

      try {
        validateDate("");
        fail("Expected validateDate to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("required");
      }
    });

    test("should throw an error for invalid date formats", () => {
      try {
        validateDate("not-a-date");
        fail("Expected validateDate to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("Invalid");
        expect(apiError.msg).toContain("format");
      }
    });

    test("should include field name in error messages", () => {
      try {
        validateDate(null, "Start time");
        fail("Expected validateDate to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toBe("Start time is required");
      }

      try {
        validateDate("invalid", "End time");
        fail("Expected validateDate to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toBe("Invalid End time format");
      }
    });
  });

  describe("validateDateRange", () => {
    test("should not throw for valid date ranges", () => {
      const startDate = new Date("2023-05-01");
      const endDate = new Date("2023-05-15");
      expect(() => validateDateRange(startDate, endDate)).not.toThrow();
    });

    test("should throw when end date is before start date", () => {
      const startDate = new Date("2023-05-15");
      const endDate = new Date("2023-05-01");

      try {
        validateDateRange(startDate, endDate);
        fail("Expected validateDateRange to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("must be after");
      }
    });

    test("should throw when dates are the same", () => {
      const date = new Date("2023-05-15");

      try {
        validateDateRange(date, date);
        fail("Expected validateDateRange to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("must be after");
      }
    });

    test("should include custom field names in error messages", () => {
      const startDate = new Date("2023-05-15");
      const endDate = new Date("2023-05-01");

      try {
        validateDateRange(startDate, endDate, "Opening", "Closing");
        fail("Expected validateDateRange to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toBe("Closing must be after Opening");
      }
    });
  });

  describe("validateEmail", () => {
    test("should return true for valid email addresses", () => {
      expect(validateEmail("user@example.com")).toBe(true);
      expect(validateEmail("firstname.lastname@domain.co.uk")).toBe(true);
      expect(validateEmail("user+tag@example.com")).toBe(true);
    });

    test("should throw an error for invalid email formats", () => {
      try {
        validateEmail("not-an-email");
        fail("Expected validateEmail to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toBe("Invalid email format");
      }

      try {
        validateEmail("missing@domain");
        fail("Expected validateEmail to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toBe("Invalid email format");
      }
    });
  });

  describe("validateUsername", () => {
    test("should return true for valid usernames", () => {
      expect(validateUsername("user123")).toBe(true);
      expect(validateUsername("john_doe")).toBe(true);
      expect(validateUsername("jane.doe")).toBe(true);
      expect(validateUsername("user-name")).toBe(true);
    });

    test("should throw an error for missing username", () => {
      try {
        validateUsername("");
        fail("Expected validateUsername to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("required");
      }

      try {
        validateUsername(null as unknown as string);
        fail("Expected validateUsername to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("required");
      }
    });

    test("should throw an error for usernames that are too short", () => {
      try {
        validateUsername("ab");
        fail("Expected validateUsername to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("between 3 and");
      }
    });

    test("should throw an error for usernames that are too long", () => {
      const longUsername = "a".repeat(31);
      try {
        validateUsername(longUsername);
        fail("Expected validateUsername to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("between 3 and");
      }
    });

    test("should accept custom length constraints", () => {
      expect(validateUsername("ab", 2, 10)).toBe(true);

      try {
        validateUsername("a", 2, 10);
        fail("Expected validateUsername to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("between 2 and 10");
      }

      try {
        validateUsername("abcdefghijk", 2, 10);
        fail("Expected validateUsername to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("between 2 and 10");
      }
    });

    test("should throw an error for usernames with invalid characters", () => {
      try {
        validateUsername("user name");
        fail("Expected validateUsername to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("can only contain");
      }

      try {
        validateUsername("user@name");
        fail("Expected validateUsername to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("can only contain");
      }
    });
  });

  describe("validatePassword", () => {
    test("should return true for valid passwords", () => {
      expect(validatePassword("password123")).toBe(true);
      expect(validatePassword("secure!Password")).toBe(true);
    });

    test("should throw an error for missing passwords", () => {
      try {
        validatePassword("");
        fail("Expected validatePassword to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("required");
      }

      try {
        validatePassword(null as unknown as string);
        fail("Expected validatePassword to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("required");
      }
    });

    test("should throw an error for passwords that are too short", () => {
      try {
        validatePassword("12345");
        fail("Expected validatePassword to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("at least 6 characters");
      }
    });

    test("should accept custom minimum length", () => {
      expect(validatePassword("1234", 4)).toBe(true);

      try {
        validatePassword("123", 4);
        fail("Expected validatePassword to throw");
      } catch (error) {
        const apiError = error as ApiError;
        expect(apiError.status).toBe(400);
        expect(apiError.msg).toContain("at least 4 characters");
      }
    });
  });
});
