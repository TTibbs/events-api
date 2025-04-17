import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { selectTeamMemberByUserId } from "../models/teams-models";
import db from "../db/connection";

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

// Helper function to calculate token expiry time in human-readable format
const getTokenExpiryInfo = (token: string): string => {
  try {
    const decoded = jwt.decode(token) as { exp?: number };
    if (!decoded || !decoded.exp) {
      return "unknown expiry time";
    }

    const expiryTimestamp = decoded.exp;
    const currentTimestamp = Math.floor(Date.now() / 1000);

    if (expiryTimestamp < currentTimestamp) {
      return "token has expired";
    }

    const secondsRemaining = expiryTimestamp - currentTimestamp;

    if (secondsRemaining < 60) {
      return `${secondsRemaining} seconds`;
    } else if (secondsRemaining < 3600) {
      return `${Math.floor(secondsRemaining / 60)} minutes`;
    } else if (secondsRemaining < 86400) {
      return `${Math.floor(secondsRemaining / 3600)} hours`;
    } else {
      return `${Math.floor(secondsRemaining / 86400)} days`;
    }
  } catch (error) {
    return "invalid token format";
  }
};

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
        msg: "Unauthorized - No token provided",
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
    if (error instanceof Error && error.name === "TokenExpiredError") {
      // Get token anyway to provide expiry info
      const token = req.headers.authorization?.split(" ")[1] || "";

      return res.status(401).json({
        status: "error",
        msg: "Unauthorized - Token expired",
        details: "Please refresh your access token or log in again",
        tokenInfo: getTokenExpiryInfo(token),
      });
    }

    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Invalid token",
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
          msg: "Unauthorized - Authentication required",
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
          msg: "Forbidden - Insufficient permissions",
        });
      }

      // Check if user has the required role
      const teamMember = await selectTeamMemberByUserId(req.user.id);

      if (!teamMember || teamMember.role !== requiredRole) {
        return res.status(403).json({
          status: "error",
          msg: "Forbidden - Insufficient permissions",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to check if user is authorized for a specific team
export const authorizeTeamAction = (requiredRoles: string[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          msg: "Unauthorized - Authentication required",
        });
      }

      const { teamId } = req.params;
      if (!teamId) {
        return res.status(400).json({
          status: "error",
          msg: "Team ID is required",
        });
      }

      // Get the user's role in the specified team
      const teamMember = await selectTeamMemberByUserId(req.user.id);

      // If user is not a member of the team or doesn't have required role
      if (
        !teamMember ||
        teamMember.team_id !== parseInt(teamId) ||
        !requiredRoles.includes(teamMember.role)
      ) {
        return res.status(403).json({
          status: "error",
          msg: "Forbidden - You don't have permission to manage this team's events",
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// Middleware to check if user can manage a specific event
export const authorizeEventAction = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          status: "error",
          msg: "Unauthorized - Authentication required",
        });
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json({
          status: "error",
          msg: "Event ID is required",
        });
      }

      // Get the event to check which team it belongs to
      const event = await db.query("SELECT team_id FROM events WHERE id = $1", [
        id,
      ]);
      if (event.rows.length === 0) {
        return res.status(404).json({
          status: "error",
          msg: "Event not found",
        });
      }

      const eventTeamId = event.rows[0].team_id;

      // Get the user's role in the event's team
      const teamMember = await selectTeamMemberByUserId(req.user.id);

      // Check if user has admin or event_manager role in the event's team
      if (
        !teamMember ||
        teamMember.team_id !== eventTeamId ||
        (teamMember.role !== "team_admin" &&
          teamMember.role !== "event_manager")
      ) {
        return res.status(403).json({
          status: "error",
          msg: "Forbidden - You don't have permission to manage this event",
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
  isAdmin: [authenticate, authorize("team_admin")],

  // Middleware to ensure user is authorized for team actions
  isTeamAdmin: [authenticate, authorize("team_admin")],

  // Middleware to ensure user can manage team events
  canManageTeamEvents: [
    authenticate,
    authorizeTeamAction(["team_admin", "event_manager"]),
  ],

  // Middleware to ensure user can manage a specific event
  canManageEvent: [authenticate, authorizeEventAction()],
};

// Export authenticate as requireAuth for clarity in routes
export const requireAuth = authenticate;
