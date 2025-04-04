import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { hasRole } from "../models/staff-member-model";

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Extend Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        username: string;
        email: string;
        role: string | null;
      };
    }
  }
}

// Middleware to verify JWT token
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized - No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: number;
      username: string;
      email: string;
      role: string | null;
    };

    // Add user data to request
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized - Token expired",
      });
    }

    return res.status(401).json({
      status: "error",
      message: "Unauthorized - Invalid token",
    });
  }
};

// Middleware to check if user has required role
export const authorize = (requiredRole: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          message: "Unauthorized - Authentication required",
        });
      }

      // If no specific role is required, just being authenticated is enough
      if (!requiredRole) {
        return next();
      }

      // If user doesn't have a role yet, deny access
      if (!req.user.role) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden - Insufficient permissions",
        });
      }

      // Check if user has the required role
      const hasRequiredRole = await hasRole(req.user.id, requiredRole);

      if (!hasRequiredRole) {
        return res.status(403).json({
          status: "error",
          message: "Forbidden - Insufficient permissions",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Shorthand middleware for common authorization patterns
export const authMiddleware = {
  // Middleware to ensure user is authenticated
  isAuthenticated: authenticate,

  // Middleware to ensure user is a staff member (admin or event_manager)
  isStaff: [authenticate, authorize("event_manager")],

  // Middleware to ensure user is an admin
  isAdmin: [authenticate, authorize("admin")],
};
