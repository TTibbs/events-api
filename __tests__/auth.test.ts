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
import jwt from "jsonwebtoken";

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

// Keep the database connection open until all tests are complete
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
    // Regular users should not have team information
    expect(body.data).not.toHaveProperty("team");
    expect(body.data).not.toHaveProperty("teamMember");
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
  // Test handling of seconds format in refresh token expiry
  test("Should handle seconds format in refresh token expiry", async () => {
    // Store original environment variable
    const originalRefreshExpiry = process.env.REFRESH_TOKEN_EXPIRY;

    // Set environment variable to seconds format
    process.env.REFRESH_TOKEN_EXPIRY = "3600";

    try {
      // Register a new user to test token generation with seconds expiry
      const newUser = {
        username: "secondsexpiryuser",
        email: "seconds@example.com",
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
  // Test for the new access token expiry
  test("Should set access token expiry to 1 day by default", async () => {
    // Store original environment variable
    const originalAccessExpiry = process.env.ACCESS_TOKEN_EXPIRY;

    // Clear environment variable to use default
    delete process.env.ACCESS_TOKEN_EXPIRY;

    try {
      // Register a new user to test token generation with default expiry
      const newUser = {
        username: "defaultexpiryuser",
        email: "default@example.com",
        password: "password123",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(newUser)
        .expect(201);

      // Verify registration was successful
      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("accessToken");

      // Decode token to verify expiry (without verification)
      const token = response.body.data.accessToken;
      const decoded = jwt.decode(token);

      // Check if expiry is approximately 1 day (with 5 minute margin for test execution time)
      const expectedExpiry = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
      const actualExpiry = (decoded as any).exp;

      expect(actualExpiry).toBeGreaterThan(expectedExpiry - 300); // Within 5 minutes of expected
      expect(actualExpiry).toBeLessThan(expectedExpiry + 300);
    } finally {
      // Restore original environment variable
      process.env.ACCESS_TOKEN_EXPIRY = originalAccessExpiry;
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

describe("Authentication - Edge Cases", () => {
  test("Should handle additional fields in registration payload", async () => {
    const userWithExtraFields = {
      username: "extrafieldsuser",
      email: "extra@example.com",
      password: "password123",
      extraField1: "should be ignored",
      extraField2: 123,
    };

    const response = await request(app)
      .post("/api/auth/register")
      .send(userWithExtraFields)
      .expect(201);

    expect(response.body.status).toBe("success");
    expect(response.body.data.user).toHaveProperty("id");
    expect(response.body.data.user.username).toBe(userWithExtraFields.username);
    expect(response.body.data.user.email).toBe(userWithExtraFields.email);
    // Extra fields should not be in the response
    expect(response.body.data.user).not.toHaveProperty("extraField1");
    expect(response.body.data.user).not.toHaveProperty("extraField2");
  });

  test("Should handle missing email in registration payload", async () => {
    const missingEmail = {
      username: "missingemail",
      password: "password123",
    };

    const response = await request(app)
      .post("/api/auth/register")
      .send(missingEmail)
      .expect(400);

    expect(response.body.status).toBe("error");
    expect(response.body.errors).toContainEqual(
      expect.objectContaining({
        message: "Email is required",
      })
    );
  });

  test("Should handle JWT errors during token refresh", async () => {
    // Use a malformed token
    const malformedToken = {
      refreshToken:
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTIzNDU2Nzg5MCwiaWF0IjoxNTE2MjM5MDIyfQ.invalid_signature",
    };

    const response = await request(app)
      .post("/api/auth/refresh-token")
      .send(malformedToken)
      .expect(401);

    expect(response.body.status).toBe("error");
    expect(response.body.msg).toBe("Invalid refresh token");
  });
});

describe("Authentication - Additional Edge Cases", () => {
  test("Should handle corrupt JWT in refresh token flow", async () => {
    // Register a new user
    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({
        username: "jwtuser",
        email: "jwt@example.com",
        password: "password123",
      })
      .expect(201);

    // Extract the refresh token
    const refreshToken = registerResponse.body.data.refreshToken;

    // Corrupt the token by cutting it off
    const corruptToken = refreshToken.substring(0, refreshToken.length - 5);

    // Try to use the corrupt token
    const response = await request(app)
      .post("/api/auth/refresh-token")
      .send({ refreshToken: corruptToken })
      .expect(401);

    expect(response.body.status).toBe("error");
    expect(response.body.msg).toBe("Invalid refresh token");
  });

  test("Should handle missing refresh token in refresh token flow", async () => {
    // Send empty body
    const response = await request(app)
      .post("/api/auth/refresh-token")
      .send({})
      .expect(400);

    expect(response.body.status).toBe("error");
    expect(response.body.errors[0].message).toBe("Refresh token is required");
  });

  test("Should handle special characters in username and password", async () => {
    const userWithSpecialChars = {
      username: "special_user@123",
      email: "special@example.com",
      password: "p@$$w0rd!",
    };

    const response = await request(app)
      .post("/api/auth/register")
      .send(userWithSpecialChars)
      .expect(201);

    expect(response.body.status).toBe("success");

    // Try to log in with the special characters
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        username: userWithSpecialChars.username,
        password: userWithSpecialChars.password,
      })
      .expect(200);

    expect(loginResponse.body.status).toBe("success");
    expect(loginResponse.body.data.user.username).toBe(
      userWithSpecialChars.username
    );
  });

  test("Should handle missing required fields in login validation", async () => {
    // Missing both username and password
    const emptyLogin = {};

    const response = await request(app)
      .post("/api/auth/login")
      .send(emptyLogin)
      .expect(400);

    expect(response.body.status).toBe("error");
    expect(response.body.errors).toHaveLength(2); // Should have 2 validation errors
    expect(response.body.errors[0].message).toBe("Username is required");
    expect(response.body.errors[1].message).toBe("Password is required");
  });
});

describe("Authentication - Event Organiser Registration", () => {
  test("Should successfully register as an event organiser with team information", async () => {
    const eventOrganiser = {
      username: "organiser123",
      email: "organiser@example.com",
      password: "password123",
      isEventOrganiser: true,
      teamName: "New Team",
      teamDescription: "Team created during registration",
    };

    const { body } = await request(app)
      .post("/api/auth/register")
      .send(eventOrganiser)
      .expect(201);

    expect(body.status).toBe("success");
    expect(body.data.user).toHaveProperty("id");
    expect(body.data.user.username).toBe(eventOrganiser.username);
    expect(body.data.user.email).toBe(eventOrganiser.email);
    expect(body.data).toHaveProperty("accessToken");
    expect(body.data).toHaveProperty("refreshToken");
    // Event organisers should have team information
    expect(body.data).toHaveProperty("team");
    expect(body.data.team.name).toBe(eventOrganiser.teamName);
    expect(body.data).toHaveProperty("teamMember");
    expect(body.data.teamMember.role).toBe("event_manager");
  });

  test("Should reject registration as an event organiser without team name", async () => {
    const invalidOrganiser = {
      username: "invalidorg",
      email: "invalid@example.com",
      password: "password123",
      isEventOrganiser: true,
      // Missing teamName
    };

    const { body } = await request(app)
      .post("/api/auth/register")
      .send(invalidOrganiser)
      .expect(400);

    expect(body.status).toBe("error");
    // The error can come from either validation or controller
    if (body.errors) {
      // If it's a validation error
      expect(body.errors).toContainEqual(
        expect.objectContaining({
          message: expect.stringMatching(/team name is required/i),
        })
      );
    } else {
      // If it's a controller error
      expect(body.msg).toMatch(/team name is required/i);
    }
  });

  test("Should successfully register as a regular user with isEventOrganiser set to false", async () => {
    const regularUser = {
      username: "regularuser456",
      email: "regular456@example.com",
      password: "password123",
      isEventOrganiser: false,
      // No team name provided, which should be allowed
    };

    const { body } = await request(app)
      .post("/api/auth/register")
      .send(regularUser)
      .expect(201);

    expect(body.status).toBe("success");
    expect(body.data.user).toHaveProperty("id");
    expect(body.data.user.username).toBe(regularUser.username);
    expect(body.data.user.email).toBe(regularUser.email);
    expect(body.data).toHaveProperty("accessToken");
    expect(body.data).toHaveProperty("refreshToken");
    // Regular users should not have team information
    expect(body.data).not.toHaveProperty("team");
    expect(body.data).not.toHaveProperty("teamMember");
  });

  test("Should successfully register as a regular user without specifying isEventOrganiser", async () => {
    const regularUser = {
      username: "regularuser789",
      email: "regular789@example.com",
      password: "password123",
      // No isEventOrganiser specified, should default to regular user
    };

    const { body } = await request(app)
      .post("/api/auth/register")
      .send(regularUser)
      .expect(201);

    expect(body.status).toBe("success");
    expect(body.data.user).toHaveProperty("id");
    expect(body.data.user.username).toBe(regularUser.username);
    expect(body.data.user.email).toBe(regularUser.email);
    expect(body.data).toHaveProperty("accessToken");
    expect(body.data).toHaveProperty("refreshToken");
    // Regular users should not have team information
    expect(body.data).not.toHaveProperty("team");
    expect(body.data).not.toHaveProperty("teamMember");
  });
});

/*
 * Auth middleware tests would require building API integration tests that exercise
 * protected endpoints. For better test organization, these should be included in their
 * respective endpoint test files rather than the auth tests.
 *
 * To improve coverage in auth-controller.ts, consider:
 *
 * 1. Mocking the jwt.verify function to test token verification failures
 * 2. Mocking database functions to test database error handling
 * 3. Creating integration tests that exercise the auth middleware in real API calls
 *
 * Since we don't want to duplicate tests across files, and we don't want to handle
 * the express error middleware logic, these tests would be better implemented as part
 * of a broader integration test suite.
 */
