import jwt from "jsonwebtoken";
import app from "../app";
import request from "supertest";
import { TestUser, TestUserRole } from "../types";

// Test User map
export const TEST_USERS: Record<string, TestUser> = {
  alice123: {
    id: 1,
    username: "alice123",
    email: "alice@example.com",
    teamId: 1,
    role: "team_admin",
  },
  bob123: {
    id: 2,
    username: "bob123",
    email: "bob@example.com",
    teamId: 3,
    role: "event_manager",
  },
  charlie123: {
    id: 3,
    username: "charlie123",
    email: "charlie@example.com",
    teamId: 2,
    role: "team_member",
  },
  siteadmin: {
    id: 4,
    username: "siteadmin",
    email: "siteadmin@example.com",
    teamId: 3,
  },
  eventmanager: {
    id: 5,
    username: "eventmanager",
    email: "eventmanager@example.com",
    teamId: 1,
    role: "event_manager",
  },
  regularuser: {
    id: 6,
    username: "regularuser",
    email: "regularuser@example.com",
  },
};

/**
 * Generate a JWT token directly for testing
 */
export function generateTestToken(
  id: number,
  username: string,
  email: string,
  role: TestUserRole | null = null
): string {
  const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

  const payload = {
    id,
    username,
    email,
    role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

/**
 * Get auth token for test users - with fallback to direct JWT generation if login fails
 */
export async function getAuthToken(
  username: string = "alice123"
): Promise<string> {
  const user = TEST_USERS[username as keyof typeof TEST_USERS];

  if (!user) {
    console.error(`Test user ${username} not defined in TEST_USERS map`);
    return generateTestToken(1, "unknown", "unknown@example.com");
  }

  try {
    // Try to log in first
    const loginCredentials = {
      username,
      password: "password123",
    };

    const response = await request(app)
      .post("/api/auth/login")
      .send(loginCredentials);

    // If login succeeds, return the token
    if (response.body?.data?.accessToken) {
      return response.body.data.accessToken;
    } else if (response.body?.accessToken) {
      return response.body.accessToken;
    }

    // If login fails, generate a token directly
    return generateTestToken(user.id, user.username, user.email, user.role);
  } catch (error) {
    // Fallback to direct token generation
    return generateTestToken(user.id, user.username, user.email, user.role);
  }
}

/**
 * Helper function to get token for a specific role
 */
export async function getTokenForRole(role: TestUserRole): Promise<string> {
  switch (role) {
    case "team_admin":
      return getAuthToken("alice123"); // Team 1 admin
    case "event_manager":
      return getAuthToken("bob123"); // Team 1 event manager
    case "team_member":
      return getAuthToken("charlie123"); // Team 2 admin
    default:
      return getAuthToken("siteadmin"); // Default to siteadmin
  }
}

/**
 * Authorize a request with the given role
 */
export async function authorizeRequest(
  request: any,
  role: TestUserRole = "team_admin"
): Promise<Response> {
  const token = await getTokenForRole(role);
  return request.set("Authorization", `Bearer ${token}`);
}
