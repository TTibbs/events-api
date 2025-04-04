import { UserSession } from "../../../types";
import jwt from "jsonwebtoken";

// Define secret keys for testing (must match those in auth-controller.ts)
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "your-refresh-secret-key";

// Generate JWT tokens for test users
const accessToken1 = jwt.sign(
  { id: 1, username: "alice123", email: "alice@example.com", role: "admin" },
  JWT_SECRET,
  { expiresIn: "15m" }
);

const refreshToken1 = jwt.sign({ id: 1 }, JWT_REFRESH_SECRET, {
  expiresIn: "7d",
});

const accessToken2 = jwt.sign(
  {
    id: 2,
    username: "bob123",
    email: "bob@example.com",
    role: "event_manager",
  },
  JWT_SECRET,
  { expiresIn: "15m" }
);

const refreshToken2 = jwt.sign({ id: 2 }, JWT_REFRESH_SECRET, {
  expiresIn: "7d",
});

export const userSessions: UserSession[] = [
  {
    user_id: 1,
    session_token: accessToken1,
    refresh_token: refreshToken1,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days from now
  },
  {
    user_id: 2,
    session_token: accessToken2,
    refresh_token: refreshToken2,
    created_at: new Date(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days from now
  },
];
