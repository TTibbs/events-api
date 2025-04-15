import app from "../app";
import request from "supertest";
import db from "../db/connection";
import seed from "../db/seeds/seed";
import {
  users,
  events,
  eventRegistrations,
  teamMembers,
  userSessions,
  teams,
  tickets,
} from "../db/data/test-data/index";

beforeEach(() =>
  seed({
    users,
    events,
    eventRegistrations,
    teamMembers,
    userSessions,
    teams,
    tickets,
  })
);

afterAll(async () => {
  await db.end();
});

const refreshToken1 = userSessions[0].refresh_token;

describe("Authentication - User Registration Functionality", () => {
  test("Should successfully register a new user and return authentication tokens", async () => {
    const newUser = {
      username: "newuser123",
      email: "newuser@example.com",
      password: "password123",
    };

    const { body } = await request(app)
      .post("/api/auth/register")
      .send(newUser)
      .expect(201);
    expect(body.status).toBe("success");
    expect(body.data.user).toHaveProperty("id");
    expect(body.data.user.username).toBe(newUser.username);
    expect(body.data.user.email).toBe(newUser.email);
    expect(body.data).toHaveProperty("accessToken");
    expect(body.data).toHaveProperty("refreshToken");
  });
  test("Should reject registration when username already exists in the system", async () => {
    const existingUser = {
      username: "alice123",
      email: "new.alice@example.com",
      password: "password123",
    };
    const {
      body: { msg },
    } = await request(app)
      .post("/api/auth/register")
      .send(existingUser)
      .expect(400);
    expect(msg).toBe("Username already exists");
  });
  test("Should reject registration when email address is already in use", async () => {
    const existingEmailUser = {
      username: "newalice",
      email: "alice@example.com",
      password: "password123",
    };
    const {
      body: { msg },
    } = await request(app)
      .post("/api/auth/register")
      .send(existingEmailUser)
      .expect(400);
    expect(msg).toBe("Email already exists");
  });
  test("Should reject registration when input validation requirements are not satisfied", async () => {
    // Missing username
    const missingUsername = {
      email: "valid@example.com",
      password: "password123",
    };

    const response1 = await request(app)
      .post("/api/auth/register")
      .send(missingUsername)
      .expect(400);
    expect(response1.body.status).toBe("error");
    expect(response1.body.errors[0].message).toBe("Username is required");
    expect(response1.body.errors[1].message).toBe(
      "Username must be between 3 and 30 characters"
    );

    // Invalid email
    const invalidEmail = {
      username: "validuser",
      email: "not-an-email",
      password: "password123",
    };

    const response2 = await request(app)
      .post("/api/auth/register")
      .send(invalidEmail)
      .expect(400);
    expect(response2.body.status).toBe("error");
    expect(response2.body.errors[0].message).toBe(
      "Must be a valid email address"
    );

    // Short password
    const shortPassword = {
      username: "validuser",
      email: "valid@example.com",
      password: "pass",
    };

    const response3 = await request(app)
      .post("/api/auth/register")
      .send(shortPassword)
      .expect(400);

    expect(response3.body.status).toBe("error");
    expect(response3.body.errors[0].message).toBe(
      "Password must be at least 6 characters"
    );
  });
});

describe("Authentication - User Login Functionality", () => {
  test("Should successfully authenticate a user with valid credentials and return tokens", async () => {
    // Note: We're assuming the password for alice123 in test data is "password123"
    // The actual hash in your user.ts needs to match this
    const loginCredentials = {
      username: "alice123",
      password: "password123",
    };

    const { body } = await request(app)
      .post("/api/auth/login")
      .send(loginCredentials)
      .expect(200);
    expect(body.status).toBe("success");
    expect(body.data.user).toHaveProperty("id");
    expect(body.data.user.username).toBe(loginCredentials.username);
    expect(body.data).toHaveProperty("accessToken");
    expect(body.data).toHaveProperty("refreshToken");
  });
  test("Should reject login attempt when username does not exist", async () => {
    const nonExistentUser = {
      username: "nonexistent",
      password: "password123",
    };
    const {
      body: { msg },
    } = await request(app)
      .post("/api/auth/login")
      .send(nonExistentUser)
      .expect(401);
    expect(msg).toBe("Invalid credentials");
  });
  test("Should reject login attempt when password is incorrect", async () => {
    const invalidPassword = {
      username: "alice123",
      password: "wrongpassword",
    };
    const {
      body: { msg },
    } = await request(app)
      .post("/api/auth/login")
      .send(invalidPassword)
      .expect(401);
    expect(msg).toBe("Invalid credentials");
  });
  test("Should validate required input fields for login", async () => {
    const missingUsername = {
      password: "password123",
    };
    const response1 = await request(app)
      .post("/api/auth/login")
      .send(missingUsername)
      .expect(400);
    expect(response1.body.status).toBe("error");
    expect(response1.body.errors[0].message).toBe("Username is required");

    // Missing password
    const missingPassword = {
      username: "alice123",
    };

    const response2 = await request(app)
      .post("/api/auth/login")
      .send(missingPassword)
      .expect(400);

    expect(response2.body.status).toBe("error");
    expect(response2.body.errors[0].message).toBe("Password is required");
  });
});

describe("Authentication - Token Refresh Functionality", () => {
  // Focus on basic validation only for token refresh
  test("Should reject token refresh request when refresh token is invalid", async () => {
    const invalidTokenData = {
      refreshToken: "invalid_refresh_token",
    };
    const {
      body: { msg },
    } = await request(app)
      .post("/api/auth/refresh-token")
      .send(invalidTokenData)
      .expect(401);
    expect(msg).toBe("Invalid refresh token");
  });
  test("Should reject token refresh request when refresh token is missing", async () => {
    const emptyRequest = {};
    const response = await request(app)
      .post("/api/auth/refresh-token")
      .send(emptyRequest);
    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.errors[0].message).toBe("Refresh token is required");
  });
  test("Should successfully refresh tokens with a valid refresh token", async () => {
    // First, register a new user to get valid tokens
    const newUser = {
      username: "refreshtestuser",
      email: "refresh@example.com",
      password: "password123",
    };

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send(newUser)
      .expect(201);

    // Extract the refresh token from the registration response
    const refreshToken = registerResponse.body.data.refreshToken;

    // Now attempt to refresh the token
    const refreshData = {
      refreshToken: refreshToken,
    };

    const refreshResponse = await request(app)
      .post("/api/auth/refresh-token")
      .send(refreshData)
      .expect(200);

    // Verify the response contains new tokens
    expect(refreshResponse.body.status).toBe("success");
    expect(refreshResponse.body.data).toHaveProperty("accessToken");
    expect(refreshResponse.body.data).toHaveProperty("refreshToken");

    // Verify the refresh token has changed
    expect(refreshResponse.body.data.refreshToken).not.toBe(refreshToken);

    // Verify the old refresh token is no longer valid
    const oldTokenResponse = await request(app)
      .post("/api/auth/refresh-token")
      .send(refreshData)
      .expect(401);

    expect(oldTokenResponse.body.status).toBe("error");
    expect(oldTokenResponse.body.msg).toBe("Invalid refresh token");
  });
  // Test handling of hours format in refresh token expiry
  test("Should handle hours format in refresh token expiry", async () => {
    // Store original environment variable
    const originalRefreshExpiry = process.env.REFRESH_TOKEN_EXPIRY;

    // Set environment variable to hours format
    process.env.REFRESH_TOKEN_EXPIRY = "2h";

    try {
      // Register a new user to test token generation with hours expiry
      const newUser = {
        username: "hoursexpiryuser",
        email: "hours@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(newUser)
        .expect(201);

      // Verify registration was successful
      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
    } finally {
      // Restore original environment variable
      process.env.REFRESH_TOKEN_EXPIRY = originalRefreshExpiry;
    }
  });
  // Test handling of minutes format in refresh token expiry
  test("Should handle minutes format in refresh token expiry", async () => {
    // Store original environment variable
    const originalRefreshExpiry = process.env.REFRESH_TOKEN_EXPIRY;

    // Set environment variable to minutes format
    process.env.REFRESH_TOKEN_EXPIRY = "30m";

    try {
      // Register a new user to test token generation with minutes expiry
      const newUser = {
        username: "minutesexpiryuser",
        email: "minutes@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(newUser)
        .expect(201);

      // Verify registration was successful
      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");
    } finally {
      // Restore original environment variable
      process.env.REFRESH_TOKEN_EXPIRY = originalRefreshExpiry;
    }
  });
});

describe("Authentication - User Logout Functionality", () => {
  test("Should successfully log out a user with a valid refresh token", async () => {
    const logoutData = {
      refreshToken: refreshToken1, // Using a token from test data
    };
    const {
      body: { msg },
    } = await request(app)
      .post("/api/auth/logout")
      .send(logoutData)
      .expect(200);
    expect(msg).toBe("Logged out successfully");
    // Verify that the refresh token can no longer be used
    const refreshResponse = await request(app)
      .post("/api/auth/refresh-token")
      .send(logoutData)
      .expect(401);
    expect(refreshResponse.body.status).toBe("error");
    expect(refreshResponse.body.msg).toBe("Invalid refresh token");
  });
  test("Should validate that refresh token is required for logout", async () => {
    const emptyRequest = {};
    const response = await request(app)
      .post("/api/auth/logout")
      .send(emptyRequest);
    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.errors[0].message).toBe("Refresh token is required");
  });
  test("Should maintain security by accepting non-existent tokens for logout", async () => {
    // This is often a security measure - even if the token doesn't exist,
    // we don't want to give that information away
    const nonExistentToken = {
      refreshToken: "completely_invalid_token_that_does_not_exist",
    };
    const {
      body: { msg },
    } = await request(app)
      .post("/api/auth/logout")
      .send(nonExistentToken)
      .expect(200);
    expect(msg).toBe("Logged out successfully");
  });
});
