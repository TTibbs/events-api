import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import {
  createSession,
  getSessionByRefreshToken,
  deleteSessionByRefreshToken,
} from "../models/user-session-model";
import {
  insertUser,
  selectUserByUsername,
  selectUserByEmail,
} from "../models/users-models";
import { selectStaffMemberByUserId } from "../models/users-models";
import { User } from "../types";

// Define a DatabaseUser type that extends User with an ID
// This represents what comes back from the database
interface DatabaseUser extends User {
  id: number;
}

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

// Helper function to generate tokens
const generateTokens = async (user: DatabaseUser) => {
  // Get staff role if exists
  const staffMember = await selectStaffMemberByUserId(user.id);

  // Create payload with user data and role
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: staffMember ? staffMember.role : null,
    // Add a timestamp to make tokens unique
    timestamp: Date.now(),
  };

  // Generate access token
  const accessToken = jwt.sign(
    payload,
    JWT_SECRET as jwt.Secret,
    {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      algorithm: "HS256",
    } as jwt.SignOptions
  );

  // Generate refresh token
  const refreshToken = jwt.sign(
    {
      id: user.id,
      // Add randomness to make refresh tokens unique
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2),
    },
    JWT_REFRESH_SECRET as jwt.Secret,
    {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      algorithm: "HS256",
    } as jwt.SignOptions
  );

  // Calculate expiry date for the refresh token
  let refreshExpirySeconds: number;
  if (typeof REFRESH_TOKEN_EXPIRY === "string") {
    // Parse string like "7d" to seconds
    if (REFRESH_TOKEN_EXPIRY.endsWith("d")) {
      // Convert days to seconds
      refreshExpirySeconds = parseInt(REFRESH_TOKEN_EXPIRY) * 24 * 60 * 60;
    } else if (REFRESH_TOKEN_EXPIRY.endsWith("h")) {
      // Convert hours to seconds
      refreshExpirySeconds = parseInt(REFRESH_TOKEN_EXPIRY) * 60 * 60;
    } else if (REFRESH_TOKEN_EXPIRY.endsWith("m")) {
      // Convert minutes to seconds
      refreshExpirySeconds = parseInt(REFRESH_TOKEN_EXPIRY) * 60;
    } else {
      // Assume seconds or use default
      refreshExpirySeconds = parseInt(REFRESH_TOKEN_EXPIRY) || 60 * 60 * 24 * 7; // Default 7 days
    }
  } else {
    refreshExpirySeconds = 60 * 60 * 24 * 7; // Default 7 days
  }

  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + refreshExpirySeconds);

  // Store refresh token in database
  await createSession(user.id, accessToken, refreshToken, expiresAt);

  return { accessToken, refreshToken };
};

// Register new user
export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, email, password } = req.body;

    // Check if username or email already exists
    try {
      const existingUsername = await selectUserByUsername(username);
      // If we get here, the username exists
      return res.status(400).json({
        status: "error",
        message: "Username already exists",
      });
    } catch (usernameError: any) {
      // If the error is a 404, it means the username doesn't exist - this is what we want
      if (usernameError.status !== 404) {
        return next(usernameError);
      }
    }

    try {
      const existingEmail = await selectUserByEmail(email);
      // If we get here, the email exists
      return res.status(400).json({
        status: "error",
        message: "Email already exists",
      });
    } catch (emailError: any) {
      // If the error is a 404, it means the email doesn't exist - this is what we want
      if (emailError.status !== 404) {
        return next(emailError);
      }
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcryptjs.hash(password, saltRounds);

    // Create user
    const newUser = await insertUser(username, email, passwordHash);

    // Since newUser comes from the database after creation,
    // it will have an ID assigned by PostgreSQL's SERIAL
    const dbUser = newUser as DatabaseUser;

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(dbUser);

    res.status(201).json({
      status: "success",
      data: {
        user: {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login user
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username, password } = req.body;

    // Find user by username
    try {
      const user = await selectUserByUsername(username);

      // Ensure user is not null before proceeding
      if (!user) {
        return res.status(401).json({
          status: "error",
          message: "Invalid credentials",
        });
      }

      // Verify password
      const isPasswordValid = await bcryptjs.compare(
        password,
        user.password_hash
      );
      if (!isPasswordValid) {
        return res.status(401).json({
          status: "error",
          message: "Invalid credentials",
        });
      }

      // The user object from database will have an ID
      const dbUser = user as DatabaseUser;

      // Generate tokens
      const { accessToken, refreshToken } = await generateTokens(dbUser);

      res.status(200).json({
        status: "success",
        data: {
          user: {
            id: dbUser.id,
            username: dbUser.username,
            email: dbUser.email,
          },
          accessToken,
          refreshToken,
        },
      });
    } catch (error: any) {
      // Handle the 404 user not found error
      if (error.status === 404) {
        return res.status(401).json({
          status: "error",
          message: "Invalid credentials",
        });
      }
      next(error);
    }
  } catch (error) {
    next(error);
  }
};

// Refresh token
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        status: "error",
        message: "Refresh token is required",
      });
    }

    // Verify if refresh token exists in database
    const session = await getSessionByRefreshToken(refreshToken);
    if (!session) {
      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token",
      });
    }

    // Verify and decode refresh token
    try {
      const decoded = jwt.verify(
        refreshToken,
        JWT_REFRESH_SECRET as jwt.Secret
      ) as {
        id: number;
      };

      // We need to create a proper DatabaseUser object
      // In this case we only need the ID since that's all we use
      const dbUser: DatabaseUser = {
        id: decoded.id,
        username: "", // These are required by DatabaseUser type
        email: "", // but not used in token generation
        password_hash: "",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const tokens = await generateTokens(dbUser);

      // Delete old refresh token
      await deleteSessionByRefreshToken(refreshToken);

      res.status(200).json({
        status: "success",
        data: tokens,
      });
    } catch (error) {
      // Delete invalid refresh token
      await deleteSessionByRefreshToken(refreshToken);

      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token",
      });
    }
  } catch (error) {
    next(error);
  }
};

// Logout user
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: "error",
        message: "Refresh token is required",
      });
    }

    // Delete session
    await deleteSessionByRefreshToken(refreshToken);

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
