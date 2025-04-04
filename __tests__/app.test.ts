import app from "../app";
import request from "supertest";
import db from "../db/connection";
import seed from "../db/seeds/seed";
import {
  users,
  events,
  eventRegistrations,
  staffMembers,
  userSessions,
} from "../db/data/test-data";
import endpointsTest from "../endpoints.json";
require("jest-sorted");

// Get the refresh tokens from the user sessions for testing
const refreshToken1 = userSessions[0].refresh_token;

beforeEach(() =>
  seed({
    users,
    events,
    eventRegistrations,
    staffMembers,
    userSessions,
  })
);
afterAll(async () => {
  await db.end();
});

describe("Basic Express Server Tests", () => {
  test("GET / responds with 200 status and a message", async () => {
    const {
      body: { msg },
    } = await request(app).get("/").expect(200);
    expect(msg).toBe("Welcome to the Promptius API!");
  });

  test("GET /api responds with an array of endpoints", async () => {
    const {
      body: { endpoints },
    } = await request(app).get("/api").expect(200);
    expect(endpoints).toEqual(endpointsTest);
  });
});

describe("Authentication - Registration Tests", () => {
  test("POST /api/auth/register - Successfully registers a new user", async () => {
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

  test("POST /api/auth/register - Fails if username already exists", async () => {
    // Using an existing username from the test data
    const existingUser = {
      username: "alice123",
      email: "new.alice@example.com",
      password: "password123",
    };

    const { body } = await request(app)
      .post("/api/auth/register")
      .send(existingUser)
      .expect(400);
    expect(body.status).toBe("error");
    expect(body.message).toBe("Username already exists");
  });

  test("POST /api/auth/register - Fails if email already exists", async () => {
    // Using an existing email from the test data
    const existingEmailUser = {
      username: "newalice",
      email: "alice@example.com",
      password: "password123",
    };

    const { body } = await request(app)
      .post("/api/auth/register")
      .send(existingEmailUser)
      .expect(400);
    expect(body.status).toBe("error");
    expect(body.message).toBe("Email already exists");
  });

  test("POST /api/auth/register - Validates input requirements", async () => {
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

describe("Authentication - Login Tests", () => {
  test("POST /api/auth/login - Successfully logs in with valid credentials", async () => {
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

  test("POST /api/auth/login - Fails with non-existent username", async () => {
    const nonExistentUser = {
      username: "nonexistent",
      password: "password123",
    };

    const response = await request(app)
      .post("/api/auth/login")
      .send(nonExistentUser)
      .expect(401);

    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Invalid credentials");
  });

  test("POST /api/auth/login - Fails with incorrect password", async () => {
    const invalidPassword = {
      username: "alice123",
      password: "wrongpassword",
    };

    const response = await request(app)
      .post("/api/auth/login")
      .send(invalidPassword)
      .expect(401);

    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Invalid credentials");
  });

  test("POST /api/auth/login - Validates input requirements", async () => {
    // Missing username
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

describe("Authentication - Token Refresh Tests", () => {
  // Focus on basic validation only for token refresh
  test("POST /api/auth/refresh-token - Fails with invalid refresh token", async () => {
    const invalidTokenData = {
      refreshToken: "invalid_refresh_token",
    };

    const response = await request(app)
      .post("/api/auth/refresh-token")
      .send(invalidTokenData)
      .expect(401);

    expect(response.body.status).toBe("error");
    expect(response.body.message).toBe("Invalid refresh token");
  });

  test("POST /api/auth/refresh-token - Fails if refresh token is missing", async () => {
    const emptyRequest = {};

    const response = await request(app)
      .post("/api/auth/refresh-token")
      .send(emptyRequest)
      .expect(400);

    expect(response.body.status).toBe("error");
    expect(response.body.errors[0].message).toBe("Refresh token is required");
  });
});

describe("Authentication - Logout Tests", () => {
  test("POST /api/auth/logout - Successfully logs out with valid refresh token", async () => {
    const logoutData = {
      refreshToken: refreshToken1, // Using a token from test data
    };

    const response = await request(app)
      .post("/api/auth/logout")
      .send(logoutData)
      .expect(200);

    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("Logged out successfully");

    // Verify that the refresh token can no longer be used
    const refreshResponse = await request(app)
      .post("/api/auth/refresh-token")
      .send(logoutData)
      .expect(401);

    expect(refreshResponse.body.status).toBe("error");
    expect(refreshResponse.body.message).toBe("Invalid refresh token");
  });

  test("POST /api/auth/logout - Validates refresh token is required", async () => {
    const emptyRequest = {};

    const response = await request(app)
      .post("/api/auth/logout")
      .send(emptyRequest)
      .expect(400);

    expect(response.body.status).toBe("error");
    expect(response.body.errors[0].message).toBe("Refresh token is required");
  });

  test("POST /api/auth/logout - Non-existent refresh token still returns success", async () => {
    // This is often a security measure - even if the token doesn't exist,
    // we don't want to give that information away
    const nonExistentToken = {
      refreshToken: "completely_invalid_token_that_does_not_exist",
    };

    const response = await request(app)
      .post("/api/auth/logout")
      .send(nonExistentToken)
      .expect(200);

    expect(response.body.status).toBe("success");
    expect(response.body.message).toBe("Logged out successfully");
  });
});
