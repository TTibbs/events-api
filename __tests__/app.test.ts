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
import { StaffMember, User } from "../types";
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

describe("GET /api/users", () => {
  test("GET /api/users - Successfully retrieves all users", async () => {
    const {
      body: { users },
    } = await request(app).get("/api/users").expect(200);
    users.forEach((user: User) => {
      expect(user).toHaveProperty("id", expect.any(Number));
      expect(user).toHaveProperty("username", expect.any(String));
      expect(user).toHaveProperty("email", expect.any(String));
    });
  });
  describe("GET /api/users/:id", () => {
    test("GET /api/users/:id - Successfully retrieves a user by ID", async () => {
      const {
        body: { user },
      } = await request(app).get("/api/users/1").expect(200);
      expect(user).toHaveProperty("id", 1);
      expect(user).toHaveProperty("username", "alice123");
    });
    test("GET /api/users/:id - Fails with non-existent user ID", async () => {
      const response = await request(app).get("/api/users/9999").expect(404);
      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("User not found");
    });
  });
  describe("GET /api/users/username/:username", () => {
    test("GET /api/users/username/:username - Successfully retrieves a user by username", async () => {
      const {
        body: { user },
      } = await request(app).get("/api/users/username/alice123").expect(200);
      expect(user).toHaveProperty("id", 1);
      expect(user).toHaveProperty("username", "alice123");
    });
    test("GET /api/users/username/:username - Fails with non-existent username", async () => {
      const response = await request(app)
        .get("/api/users/username/nonexistent")
        .expect(404);
      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("User not found");
    });
  });
  describe("GET /api/users/email/:email", () => {
    test("GET /api/users/email/:email - Successfully retrieves a user by email", async () => {
      const {
        body: { user },
      } = await request(app)
        .get("/api/users/email/alice@example.com")
        .expect(200);
      expect(user).toHaveProperty("id", 1);
      expect(user).toHaveProperty("email", "alice@example.com");
    });
    test("GET /api/users/email/:email - Fails with non-existent email", async () => {
      const response = await request(app)
        .get("/api/users/email/nonexistent@example.com")
        .expect(404);
      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("User not found");
    });
  });
});

describe("Tests for /api/staff", () => {
  test("GET /api/staff - Successfully retrieves all staff members", async () => {
    const {
      body: { staffMembers },
    } = await request(app).get("/api/users/staff").expect(200);
    staffMembers.forEach((staffMember: StaffMember) => {
      expect(staffMember).toHaveProperty("id", expect.any(Number));
      expect(staffMember).toHaveProperty("user_id", expect.any(Number));
      expect(staffMember).toHaveProperty("role", expect.any(String));
    });
  });
  describe("GET /api/staff/:id", () => {
    test("GET /api/staff/:id - Successfully retrieves a staff member by ID", async () => {
      const {
        body: { staffMember },
      } = await request(app).get("/api/users/staff/1").expect(200);
      expect(staffMember).toHaveProperty("id", 1);
    });
    test("GET /api/staff/:id - Fails with non-existent staff member ID", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/users/staff/9999").expect(404);
      expect(msg).toBe("Staff member not found");
    });
  });
});

describe("POST /api/users", () => {
  test("POST /api/users - Successfully creates a new user", async () => {
    const insertedUser = {
      username: "newuser123",
      email: "newuser@example.com",
      password_hash: "password123",
    };
    const {
      body: { newUser },
    } = await request(app).post("/api/users").send(insertedUser).expect(201);
    expect(newUser).toHaveProperty("id", expect.any(Number));
    expect(newUser).toHaveProperty("username", expect.any(String));
    expect(newUser).toHaveProperty("email", expect.any(String));
  });
  test("POST /api/users - Fails if no username is provided", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ email: "test@example.com", password_hash: "password123" })
      .expect(400);
    expect(response.body.status).toBe("error");
    expect(response.body.msg).toBe("Username is required");
  });
  test("POST /api/users - Fails if no email is provided", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ username: "testuser", password_hash: "password123" })
      .expect(400);
    expect(response.body.status).toBe("error");
    expect(response.body.msg).toBe("Email is required");
  });
  test("POST /api/users - Fails if no password is provided", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({ username: "testuser", email: "test@example.com" })
      .expect(400);
    expect(response.body.status).toBe("error");
    expect(response.body.msg).toBe("Password is required");
  });
  test("POST /api/users - Fails with appropriate message if multiple fields are missing", async () => {
    const response = await request(app)
      .post("/api/users")
      .send({}) // No fields provided
      .expect(400);
    expect(response.body.status).toBe("error");
    expect(response.body.msg).toBe("Missing required fields");
    expect(response.body.errors).toEqual([
      "Username is required",
      "Email is required",
      "Password is required",
    ]);

    // Test with just one field provided
    const responseWithOnlyUsername = await request(app)
      .post("/api/users")
      .send({ username: "testuser" })
      .expect(400);
    expect(responseWithOnlyUsername.body.status).toBe("error");
    expect(responseWithOnlyUsername.body.msg).toBe("Missing required fields");
    expect(responseWithOnlyUsername.body.errors).toEqual([
      "Email is required",
      "Password is required",
    ]);
  });
});

describe("POST /api/staff", () => {
  test("POST /api/staff - Successfully creates a new staff member", async () => {
    const insertedStaffMember = {
      user_id: 1,
      role: "admin",
    };
    const {
      body: { newStaffMember },
    } = await request(app)
      .post("/api/users/staff")
      .send(insertedStaffMember)
      .expect(201);
    expect(newStaffMember).toHaveProperty("id", expect.any(Number));
    expect(newStaffMember).toHaveProperty("user_id", 1);
    expect(newStaffMember).toHaveProperty("role", "admin");
  });

  test("POST /api/staff - Fails when trying to create a staff member for non-existent user", async () => {
    const nonExistentUserStaffMember = {
      user_id: 9999, // This ID doesn't exist in the test data
      role: "event_manager",
    };

    const response = await request(app)
      .post("/api/users/staff")
      .send(nonExistentUserStaffMember)
      .expect(404);

    expect(response.body.status).toBe("error");
    expect(response.body.msg).toBe(
      "User not found. Cannot create staff member for non-existent user."
    );
  });

  test("POST /api/staff - Successfully creates a new user and staff member in one step", async () => {
    const newUserStaffMember = {
      username: "newstaffuser",
      email: "newstaff@example.com",
      password_hash: "password123",
      role: "event_manager",
    };

    const response = await request(app)
      .post("/api/users/staff")
      .send(newUserStaffMember)
      .expect(201);

    expect(response.body).toHaveProperty("newUser");
    expect(response.body).toHaveProperty("newStaffMember");
    expect(response.body.msg).toBe(
      "User and staff member created successfully"
    );

    // Verify user was created with correct data
    expect(response.body.newUser.username).toBe(newUserStaffMember.username);
    expect(response.body.newUser.email).toBe(newUserStaffMember.email);

    // Verify staff member was created correctly
    expect(response.body.newStaffMember.role).toBe(newUserStaffMember.role);
    expect(response.body.newStaffMember.user_id).toBe(response.body.newUser.id);
  });
});
