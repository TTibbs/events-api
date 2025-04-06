import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  authenticate,
  authorize,
  authMiddleware,
} from "../middlewares/auth-middleware";
import { selectTeamMemberByUserId } from "../models/teams-models";

// Mock the teams-models functions
jest.mock("../models/teams-models", () => ({
  selectTeamMemberByUserId: jest.fn(),
}));

// Mock JWT
jest.mock("jsonwebtoken");

describe("Authentication Middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    nextFunction = jest.fn();

    // Reset mocks
    (jwt.verify as jest.Mock).mockReset();
    (selectTeamMemberByUserId as jest.Mock).mockReset();
  });

  describe("authenticate middleware", () => {
    test("should pass authentication with valid token", () => {
      const userData = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "admin",
      };

      mockRequest.headers = {
        authorization: "Bearer valid-token",
      };

      (jwt.verify as jest.Mock).mockReturnValue(userData);

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(jwt.verify).toHaveBeenCalledWith(
        "valid-token",
        expect.any(String)
      );
      expect(mockRequest.user).toEqual(userData);
      expect(nextFunction).toHaveBeenCalled();
    });

    test("should reject requests with no authorization header", () => {
      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "error",
        msg: "Unauthorized - No token provided",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test("should reject requests with non-Bearer authorization", () => {
      mockRequest.headers = {
        authorization: "Basic some-credentials",
      };

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "error",
        msg: "Unauthorized - No token provided",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test("should handle expired tokens", () => {
      mockRequest.headers = {
        authorization: "Bearer expired-token",
      };

      const tokenError = new Error("TokenExpiredError");
      (tokenError as any).name = "TokenExpiredError";

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw tokenError;
      });

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "error",
        msg: "Unauthorized - Token expired",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test("should handle invalid tokens", () => {
      mockRequest.headers = {
        authorization: "Bearer invalid-token",
      };

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid token");
      });

      authenticate(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "error",
        msg: "Unauthorized - Invalid token",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe("authorize middleware", () => {
    test("should authorize user with the required role", async () => {
      mockRequest.user = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "admin",
      };

      (selectTeamMemberByUserId as jest.Mock).mockResolvedValue({
        id: 1,
        user_id: 1,
        team_id: 1,
        role: "admin",
      });

      await authorize("admin")(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(selectTeamMemberByUserId).toHaveBeenCalledWith(1);
      expect(nextFunction).toHaveBeenCalled();
    });

    test("should reject unauthorized users", async () => {
      mockRequest.user = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "user",
      };

      (selectTeamMemberByUserId as jest.Mock).mockResolvedValue({
        id: 1,
        user_id: 1,
        team_id: 1,
        role: "user",
      });

      await authorize("admin")(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "error",
        msg: "Forbidden - Insufficient permissions",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test("should reject when no user is authenticated", async () => {
      await authorize("admin")(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "error",
        msg: "Unauthorized - Authentication required",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test("should allow when no specific role is required", async () => {
      mockRequest.user = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "user",
      };

      await authorize("")(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalled();
    });

    test("should reject when user has no role assigned", async () => {
      mockRequest.user = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: null,
      };

      await authorize("admin")(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "error",
        msg: "Forbidden - Insufficient permissions",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    test("should handle database errors", async () => {
      mockRequest.user = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "admin",
      };

      const error = new Error("Database error");
      (selectTeamMemberByUserId as jest.Mock).mockRejectedValue(error);

      await authorize("admin")(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(nextFunction).toHaveBeenCalledWith(error);
    });

    test("should reject when team member not found", async () => {
      mockRequest.user = {
        id: 1,
        username: "testuser",
        email: "test@example.com",
        role: "admin",
      };

      (selectTeamMemberByUserId as jest.Mock).mockResolvedValue(null);

      await authorize("admin")(
        mockRequest as Request,
        mockResponse as Response,
        nextFunction
      );

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: "error",
        msg: "Forbidden - Insufficient permissions",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe("authMiddleware shortcuts", () => {
    test("should have isAuthenticated shortcut", () => {
      expect(authMiddleware.isAuthenticated).toBe(authenticate);
    });

    test("should have isAdmin shortcut", () => {
      expect(Array.isArray(authMiddleware.isAdmin)).toBe(true);
      expect(authMiddleware.isAdmin.length).toBe(2);
      expect(authMiddleware.isAdmin[0]).toBe(authenticate);
    });

    test("should have isStaff shortcut", () => {
      expect(Array.isArray(authMiddleware.isStaff)).toBe(true);
      expect(authMiddleware.isStaff.length).toBe(2);
      expect(authMiddleware.isStaff[0]).toBe(authenticate);
    });
  });
});
