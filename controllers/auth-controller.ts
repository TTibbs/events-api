import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import {
  createSession,
  getSessionByRefreshToken,
  deleteSessionByRefreshToken,
} from "../models/user-session-model";
import {
  createUser,
  getUserByUsername,
  getUserByEmail,
} from "../models/users-models";
import { getStaffMemberByUserId } from "../models/staff-member-model";
import { User } from "../types";

// Extended User type with id
interface UserWithId extends User {
  id: number;
}

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";
const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";

// Helper function to generate tokens
const generateTokens = async (user: UserWithId) => {
  // Get staff role if exists
  const staffMember = await getStaffMemberByUserId(user.id);

  // Create payload with user data and role
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: staffMember ? staffMember.role : null,
  };

  // Generate access token - Use as unknown assertion to avoid TypeScript errors
  // This is a workaround for the type issues with jsonwebtoken
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
    { id: user.id },
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
    const existingUsername = await getUserByUsername(username);
    if (existingUsername) {
      return res.status(400).json({
        status: "error",
        message: "Username already exists",
      });
    }

    const existingEmail = await getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({
        status: "error",
        message: "Email already exists",
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcryptjs.hash(password, saltRounds);

    // Create user
    const newUser = await createUser(username, email, passwordHash);

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(
      newUser as UserWithId
    );

    res.status(201).json({
      status: "success",
      data: {
        user: {
          id: (newUser as UserWithId).id,
          username: newUser.username,
          email: newUser.email,
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
    const user = await getUserByUsername(username);
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

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(
      user as UserWithId
    );

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: (user as UserWithId).id,
          username: user.username,
          email: user.email,
        },
        accessToken,
        refreshToken,
      },
    });
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

      // Generate new tokens
      const user = { id: decoded.id } as UserWithId;
      const tokens = await generateTokens(user);

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
