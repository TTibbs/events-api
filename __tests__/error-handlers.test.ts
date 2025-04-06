import {
  ApiError,
  createNotFoundError,
  createBadRequestError,
  createUnauthorizedError,
  createForbiddenError,
  createConflictError,
  validateRequiredFields,
} from "../utils/error-handlers";

describe("Error Handler Utility Functions", () => {
  describe("createNotFoundError", () => {
    test("should create a 404 error with entity name", () => {
      const error = createNotFoundError("User");
      expect(error).toEqual({
        status: 404,
        msg: "User not found",
      });
    });

    test("should create a 404 error with entity name and ID", () => {
      const error = createNotFoundError("User", 123);
      expect(error).toEqual({
        status: 404,
        msg: "User not found",
      });
    });
  });

  describe("createBadRequestError", () => {
    test("should create a 400 error with message", () => {
      const error = createBadRequestError("Invalid input");
      expect(error).toEqual({
        status: 400,
        msg: "Invalid input",
        errors: undefined,
      });
    });

    test("should create a 400 error with message and specific errors", () => {
      const specificErrors = ["Field1 is required", "Field2 must be a number"];
      const error = createBadRequestError("Validation failed", specificErrors);
      expect(error).toEqual({
        status: 400,
        msg: "Validation failed",
        errors: specificErrors,
      });
    });
  });

  describe("createUnauthorizedError", () => {
    test("should create a 401 error with default message", () => {
      const error = createUnauthorizedError();
      expect(error).toEqual({
        status: 401,
        msg: "Unauthorized",
      });
    });

    test("should create a 401 error with custom message", () => {
      const error = createUnauthorizedError("Invalid credentials");
      expect(error).toEqual({
        status: 401,
        msg: "Invalid credentials",
      });
    });
  });

  describe("createForbiddenError", () => {
    test("should create a 403 error with default message", () => {
      const error = createForbiddenError();
      expect(error).toEqual({
        status: 403,
        msg: "Forbidden",
      });
    });

    test("should create a 403 error with custom message", () => {
      const error = createForbiddenError("Insufficient permissions");
      expect(error).toEqual({
        status: 403,
        msg: "Insufficient permissions",
      });
    });
  });

  describe("createConflictError", () => {
    test("should create a 409 error with message", () => {
      const error = createConflictError("Resource already exists");
      expect(error).toEqual({
        status: 409,
        msg: "Resource already exists",
      });
    });
  });

  describe("validateRequiredFields", () => {
    test("should return undefined when all required fields are present", () => {
      const fields = {
        name: "John Doe",
        email: "john@example.com",
        age: 30,
      };

      const result = validateRequiredFields(fields);
      expect(result).toBeUndefined();
    });

    test("should detect a single missing field", () => {
      const fields = {
        name: "John Doe",
        email: "",
        age: 30,
      };

      const result = validateRequiredFields(fields);
      expect(result).toEqual({
        status: 400,
        msg: "email is required",
        errors: ["email is required"],
      });
    });

    test("should detect multiple missing fields", () => {
      const fields = {
        name: "",
        email: null,
        age: undefined,
      };

      const result = validateRequiredFields(fields);
      expect(result).toEqual({
        status: 400,
        msg: "Missing required fields",
        errors: ["name is required", "email is required", "age is required"],
      });
    });

    test("should handle empty objects", () => {
      const fields = {};

      const result = validateRequiredFields(fields);
      expect(result).toBeUndefined();
    });

    test("should handle null values", () => {
      const fields = {
        name: null,
        email: "john@example.com",
      };

      const result = validateRequiredFields(fields);
      expect(result).toEqual({
        status: 400,
        msg: "name is required",
        errors: ["name is required"],
      });
    });

    test("should handle undefined values", () => {
      const fields = {
        name: "John Doe",
        email: undefined,
      };

      const result = validateRequiredFields(fields);
      expect(result).toEqual({
        status: 400,
        msg: "email is required",
        errors: ["email is required"],
      });
    });

    test("should handle empty strings", () => {
      const fields = {
        name: "John Doe",
        email: "",
      };

      const result = validateRequiredFields(fields);
      expect(result).toEqual({
        status: 400,
        msg: "email is required",
        errors: ["email is required"],
      });
    });
  });
});
