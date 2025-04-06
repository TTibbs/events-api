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
import endpointsTest from "../endpoints.json";
import {
  Team,
  TeamMember,
  User,
  TicketResponse,
  TicketWithEventInfo,
  EventResponse,
  EventRegistrationResponse,
  EventAvailabilityResponse,
} from "../types";
import * as ticketModels from "../models/tickets-models";
require("jest-sorted");

// Get the refresh tokens from the user sessions for testing
const refreshToken1 = userSessions[0].refresh_token;

// Add this function after other imports but before the tests
async function getAuthToken() {
  // Use a known existing user from seed data
  const loginCredentials = {
    username: "alice123",
    password: "password123",
  };

  // Login with the user to get tokens
  const response = await request(app)
    .post("/api/auth/login")
    .send(loginCredentials);

  // Debug log
  console.log("Auth response:", JSON.stringify(response.body, null, 2));

  // Return the access token for authentication
  return response.body.data.accessToken;
}

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

// Update the afterAll hook to properly close DB connection
afterAll(async () => {
  // Close any pending database transactions/connections
  await db.end();
});

describe("Basic Express Server Endpoint Tests", () => {
  test("GET / should respond with a 200 status code and welcome message", async () => {
    const {
      body: { msg },
    } = await request(app).get("/").expect(200);
    expect(msg).toBe("Welcome to the Promptius API!");
  });
  test("GET /api should return a comprehensive list of available endpoints", async () => {
    const {
      body: { endpoints },
    } = await request(app).get("/api").expect(200);
    expect(endpoints).toEqual(endpointsTest);
  });
});

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

describe("Users API Endpoints", () => {
  describe("GET /api/users - User Listing", () => {
    test("Should successfully retrieve a list of all users", async () => {
      const {
        body: { users },
      } = await request(app).get("/api/users").expect(200);
      users.forEach((user: User) => {
        expect(user).toHaveProperty("id", expect.any(Number));
        expect(user).toHaveProperty("username", expect.any(String));
        expect(user).toHaveProperty("email", expect.any(String));
      });
    });
    describe("GET /api/users/:id - User Lookup by ID", () => {
      test("Should successfully retrieve a user when provided a valid ID", async () => {
        const {
          body: { user },
        } = await request(app).get("/api/users/1").expect(200);
        expect(user).toHaveProperty("id", 1);
        expect(user).toHaveProperty("username", "alice123");
      });
      test("Should return appropriate error when user ID does not exist", async () => {
        const {
          body: { msg },
        } = await request(app).get("/api/users/9999").expect(404);
        expect(msg).toBe("User not found");
      });
    });
    describe("GET /api/users/username/:username - User Lookup by Username", () => {
      test("Should successfully retrieve a user when provided a valid username", async () => {
        const {
          body: { user },
        } = await request(app).get("/api/users/username/alice123").expect(200);
        expect(user).toHaveProperty("id", 1);
        expect(user).toHaveProperty("username", "alice123");
      });
      test("Should return appropriate error when username does not exist", async () => {
        const {
          body: { msg },
        } = await request(app)
          .get("/api/users/username/nonexistent")
          .expect(404);
        expect(msg).toBe("User not found");
      });
    });
    describe("GET /api/users/email/:email - User Lookup by Email", () => {
      test("Should successfully retrieve a user when provided a valid email address", async () => {
        const {
          body: { user },
        } = await request(app)
          .get("/api/users/email/alice@example.com")
          .expect(200);
        expect(user).toHaveProperty("id", 1);
        expect(user).toHaveProperty("email", "alice@example.com");
      });
      test("Should return appropriate error when email address does not exist", async () => {
        const {
          body: { msg },
        } = await request(app)
          .get("/api/users/email/nonexistent@example.com")
          .expect(404);
        expect(msg).toBe("User not found");
      });
    });
  });
  describe("POST /api/users - User Creation", () => {
    test("Should successfully create a new user with valid details", async () => {
      const insertedUser = {
        username: "newuser123",
        email: "newuser@example.com",
        plainPassword: "password123",
      };

      const {
        body: { newUser },
      } = await request(app).post("/api/users").send(insertedUser).expect(201);

      expect(newUser).toHaveProperty("id", expect.any(Number));
      expect(newUser).toHaveProperty("username", expect.any(String));
      expect(newUser).toHaveProperty("email", expect.any(String));
    });

    test("Should reject user creation when username is missing", async () => {
      const {
        body: { msg },
      } = await request(app)
        .post("/api/users")
        .send({ email: "test@example.com", plainPassword: "password123" })
        .expect(400);

      expect(msg).toBe("Username is required");
    });

    test("Should reject user creation when email is missing", async () => {
      const {
        body: { msg },
      } = await request(app)
        .post("/api/users")
        .send({ username: "testuser", plainPassword: "password123" })
        .expect(400);

      expect(msg).toBe("Email is required");
    });

    test("Should reject user creation when password is missing", async () => {
      const {
        body: { msg },
      } = await request(app)
        .post("/api/users")
        .send({ username: "testuser", email: "test@example.com" })
        .expect(400);

      expect(msg).toBe("Password is required");
    });

    test("Should provide comprehensive error message when multiple required fields are missing", async () => {
      const { body } = await request(app)
        .post("/api/users")
        .send({}) // No fields provided
        .expect(400);

      expect(body.msg).toBe("Missing required fields");
      expect(body.errors).toEqual([
        "Username is required",
        "Email is required",
        "Password is required",
      ]);

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
  describe("DELETE /api/users/:id - User Deletion", () => {
    test("Should successfully delete a user with valid ID and authentication", async () => {
      // Create a user to delete
      const userToDelete = {
        username: `delete_user_${Date.now()}`,
        email: `delete_user_${Date.now()}@example.com`,
        plainPassword: "password123",
      };

      const createResponse = await request(app)
        .post("/api/users")
        .send(userToDelete)
        .expect(201);

      const userId = createResponse.body.newUser.id;

      // Get authentication token
      const token = await getAuthToken();

      // Delete the user with authentication
      await request(app)
        .delete(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      // Verify user is deleted
      await request(app).get(`/api/users/${userId}`).expect(404);
    });

    test("Should reject user deletion when not authenticated", async () => {
      // Try to delete a user without authentication
      const response = await request(app).delete("/api/users/1").expect(401);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Unauthorized - No token provided");
    });
  });

  describe("PATCH /api/users/:id - User Update", () => {
    test("Should successfully update a user with valid details and authentication", async () => {
      // Create a user to update
      const userToUpdate = {
        username: `update_user_${Date.now()}`,
        email: `update_user_${Date.now()}@example.com`,
        plainPassword: "password123",
      };

      const createResponse = await request(app)
        .post("/api/users")
        .send(userToUpdate)
        .expect(201);

      const userId = createResponse.body.newUser.id;

      // Get authentication token
      const token = await getAuthToken();

      // Update data
      const updateData = {
        username: `updated_${userToUpdate.username}`,
        email: `updated_${userToUpdate.email}`,
      };

      // Update the user with authentication
      const { body } = await request(app)
        .patch(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(body.status).toBe("success");
      expect(body.msg).toBe("User updated successfully");
      expect(body.user.username).toBe(updateData.username);
      expect(body.user.email).toBe(updateData.email);
    });

    test("Should reject user update when not authenticated", async () => {
      // Try to update a user without authentication
      const response = await request(app)
        .patch("/api/users/1")
        .send({ username: "new_username" })
        .expect(401);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Unauthorized - No token provided");
    });

    test("Should prevent updating to an existing username (409 Conflict)", async () => {
      // Create two users, then try to update one to have the same username as the other
      const user1 = {
        username: `conflict_user1_${Date.now()}`,
        email: `conflict1_${Date.now()}@example.com`,
        plainPassword: "password123",
      };

      const user2 = {
        username: `conflict_user2_${Date.now()}`,
        email: `conflict2_${Date.now()}@example.com`,
        plainPassword: "password123",
      };

      // Create the users
      const createResponse1 = await request(app)
        .post("/api/users")
        .send(user1)
        .expect(201);

      const createResponse2 = await request(app)
        .post("/api/users")
        .send(user2)
        .expect(201);

      const userId2 = createResponse2.body.newUser.id;

      // Get authentication token
      const token = await getAuthToken();

      // Try to update user2 to have the same username as user1
      const response = await request(app)
        .patch(`/api/users/${userId2}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ username: user1.username })
        .expect(409);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Username already exists");
    });
  });
});

describe("Teams API Endpoints", () => {
  describe("GET /api/teams - Team Listing", () => {
    test("Should successfully retrieve a list of all teams", async () => {
      const {
        body: { teams },
      } = await request(app).get("/api/teams").expect(200);
      expect(teams).toHaveLength(2);
      teams.forEach((team: Team[]) => {
        expect(team).toHaveProperty("id", expect.any(Number));
        expect(team).toHaveProperty("name", expect.any(String));
        expect(team).toHaveProperty("description", expect.any(String));
      });
    });
  });
  describe("GET /api/teams/:id - Team Lookup by ID", () => {
    test("Should successfully retrieve a team when provided a valid ID", async () => {
      const {
        body: { team },
      } = await request(app).get("/api/teams/1").expect(200);
      expect(team).toHaveProperty("id", 1);
      expect(team).toHaveProperty("name", "Tech Events Team");
    });
    test("Should return appropriate error when team ID does not exist", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/teams/9999").expect(404);
      expect(msg).toBe("Team not found");
    });
  });
  describe("GET /api/teams/members - Team Members Listing", () => {
    test("Should successfully retrieve a list of all team members", async () => {
      const {
        body: { teamMembers },
      } = await request(app).get("/api/teams/members").expect(200);
      teamMembers.forEach((teamMember: TeamMember) => {
        expect(teamMember).toHaveProperty("id", expect.any(Number));
        expect(teamMember).toHaveProperty("user_id", expect.any(Number));
        expect(teamMember).toHaveProperty("team_id", expect.any(Number));
        expect(teamMember).toHaveProperty("role", expect.any(String));
      });
    });
    describe("GET /api/teams/members/:id - Team Member Lookup by ID", () => {
      test("Should successfully retrieve a team member when provided a valid ID", async () => {
        const {
          body: { teamMember },
        } = await request(app).get("/api/teams/members/1").expect(200);
        expect(teamMember).toHaveProperty("id", 1);
      });
      test("Should return appropriate error when team member ID does not exist", async () => {
        const {
          body: { msg },
        } = await request(app).get("/api/teams/members/9999").expect(404);
        expect(msg).toBe("Team member not found");
      });
    });
    describe("GET /api/teams/members/user/:userId - Team Member Lookup by User ID", () => {
      test("Should successfully retrieve a team member when provided a valid user ID", async () => {
        const {
          body: { teamMember },
        } = await request(app).get("/api/teams/members/user/1").expect(200);
        expect(teamMember).toHaveProperty("user_id", 1);
        expect(teamMember).toHaveProperty("team_id", expect.any(Number));
        expect(teamMember).toHaveProperty("role", expect.any(String));
      });

      test("Should return appropriate error when user has no team member record", async () => {
        // Using a user ID that doesn't have a team member record (use a high number to avoid conflicts)
        const {
          body: { msg },
        } = await request(app).get("/api/teams/members/user/9999").expect(404);
        expect(msg).toBe("Team member not found");
      });
    });
  });
  describe("POST /api/teams - Team Creation", () => {
    test("Should successfully create a new team with valid details", async () => {
      const newTeam = {
        name: "Marketing Team",
        description: "Team for marketing events and promotions",
      };

      const {
        body: { newTeam: createdTeam },
      } = await request(app).post("/api/teams").send(newTeam).expect(201);

      expect(createdTeam).toHaveProperty("id", expect.any(Number));
      expect(createdTeam.name).toBe(newTeam.name);
      expect(createdTeam.description).toBe(newTeam.description);
    });
    test("Should reject team creation when name is missing", async () => {
      const noNameTeam = {
        description: "This team has no name",
      };
      const {
        body: { msg },
      } = await request(app).post("/api/teams").send(noNameTeam).expect(400);
      expect(msg).toBe("Team name is required");
    });
    test("Should reject team creation when request body is empty", async () => {
      const {
        body: { msg },
      } = await request(app).post("/api/teams").send({}).expect(400);
      expect(msg).toBe("Missing required fields");
    });

    // Add test for description without name
    test("Should reject team creation when only description is provided without name", async () => {
      const onlyDescriptionTeam = {
        description: "This is just a description without a team name",
      };
      const {
        body: { msg },
      } = await request(app)
        .post("/api/teams")
        .send(onlyDescriptionTeam)
        .expect(400);
      expect(msg).toBe("Team name is required");
    });

    // Add test for team creation with just the name (no description)
    test("Should successfully create a team with only a name (no description)", async () => {
      const nameOnlyTeam = {
        name: "Name Only Team",
      };
      const {
        body: { newTeam },
      } = await request(app).post("/api/teams").send(nameOnlyTeam).expect(201);
      expect(newTeam).toHaveProperty("id", expect.any(Number));
      expect(newTeam.name).toBe(nameOnlyTeam.name);
      expect(newTeam.description).toBeNull(); // Description should be null
    });
  });
  describe("POST /api/teams/members - Team Member Creation", () => {
    test("Should successfully create a new team member with valid details", async () => {
      const insertedTeamMember = {
        user_id: 3, // Changed from 1 to 3 to avoid duplicate constraint with team_id 1
        team_id: 1,
        role: "admin",
      };
      const {
        body: { newTeamMember },
      } = await request(app)
        .post("/api/teams/members")
        .send(insertedTeamMember)
        .expect(201);
      expect(newTeamMember).toHaveProperty("id", expect.any(Number));
      expect(newTeamMember).toHaveProperty("user_id", 3);
      expect(newTeamMember).toHaveProperty("team_id", 1);
      expect(newTeamMember).toHaveProperty("role", "admin");
    });
    test("Should reject team member creation when user does not exist", async () => {
      const nonExistentUserTeamMember = {
        user_id: 9999, // This ID doesn't exist in the test data
        team_id: 1,
        role: "event_manager",
      };

      const response = await request(app)
        .post("/api/teams/members")
        .send(nonExistentUserTeamMember)
        .expect(404);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe(
        "User not found. Cannot create team member for non-existent user."
      );
    });
    test("Should support creating a new user and team member simultaneously", async () => {
      const newUserTeamMember = {
        username: "newteamuser",
        email: "newteam@example.com",
        plainPassword: "password123",
        team_id: 1,
        role: "event_manager",
      };

      const response = await request(app)
        .post("/api/teams/members")
        .send(newUserTeamMember)
        .expect(201);

      expect(response.body).toHaveProperty("newUser");
      expect(response.body).toHaveProperty("newTeamMember");
      expect(response.body.msg).toBe(
        "User and team member created successfully"
      );
      expect(response.body.newUser.username).toBe(newUserTeamMember.username);
      expect(response.body.newUser.email).toBe(newUserTeamMember.email);
      expect(response.body.newTeamMember.role).toBe(newUserTeamMember.role);
      expect(response.body.newTeamMember.user_id).toBe(
        response.body.newUser.id
      );
      expect(response.body.newTeamMember.team_id).toBe(
        newUserTeamMember.team_id
      );
    });

    // New tests to improve branch coverage
    test("Should reject team member creation when role is missing with existing user", async () => {
      const missingRoleTeamMember = {
        user_id: 3,
        team_id: 1,
        // role is missing
      };

      const response = await request(app)
        .post("/api/teams/members")
        .send(missingRoleTeamMember)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Role is required");
    });

    test("Should reject team member creation when team_id is missing with existing user", async () => {
      const missingTeamIdTeamMember = {
        user_id: 3,
        role: "admin",
        // team_id is missing
      };

      const response = await request(app)
        .post("/api/teams/members")
        .send(missingTeamIdTeamMember)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Team ID is required");
    });

    test("Should reject new user team member creation when required fields are missing", async () => {
      // Missing username
      const missingUsernameTeamMember = {
        // username is missing
        email: "newmember@example.com",
        password: "password123",
        team_id: 1,
        role: "member",
      };

      const response1 = await request(app)
        .post("/api/teams/members")
        .send(missingUsernameTeamMember)
        .expect(400);

      expect(response1.body.status).toBe("error");
      expect(response1.body.errors).toContain(
        "Username is required when creating a new user"
      );

      // Missing email
      const missingEmailTeamMember = {
        username: "newmemberuser",
        // email is missing
        password: "password123",
        team_id: 1,
        role: "member",
      };

      const response2 = await request(app)
        .post("/api/teams/members")
        .send(missingEmailTeamMember)
        .expect(400);

      expect(response2.body.status).toBe("error");
      expect(response2.body.errors).toContain(
        "Email is required when creating a new user"
      );

      // Missing password
      const missingPasswordTeamMember = {
        username: "newmemberuser",
        email: "newmember@example.com",
        // password is missing
        team_id: 1,
        role: "member",
      };

      const response3 = await request(app)
        .post("/api/teams/members")
        .send(missingPasswordTeamMember)
        .expect(400);

      expect(response3.body.status).toBe("error");
      expect(response3.body.errors).toContain(
        "Password is required when creating a new user"
      );
    });

    test("Should reject new user team member creation when username is already in use", async () => {
      // Use an existing username from the seed data instead of creating one
      const duplicateUsernameTeamMember = {
        username: "alice123", // This username already exists in seed data
        email: "another@example.com", // Different email
        plainPassword: "password123",
        team_id: 1,
        role: "member",
      };

      const response = await request(app)
        .post("/api/teams/members")
        .send(duplicateUsernameTeamMember)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe(
        "Failed to create new user. Username or email may already be in use."
      );
      // No need to check for specific errors
    });
  });
  describe("PATCH /api/teams/:id - Team Update", () => {
    test("Should successfully update a team with valid details", async () => {
      const updatedTeamData = {
        name: "Updated Team Name",
        description: "Updated team description",
      };
      const {
        body: { updatedTeam },
      } = await request(app)
        .patch("/api/teams/1")
        .send(updatedTeamData)
        .expect(200);
      expect(updatedTeam).toHaveProperty("id", 1);
      expect(updatedTeam.name).toBe("Updated Team Name");
      expect(updatedTeam.description).toBe("Updated team description");
    });
    test("Should return appropriate error when attempting to update non-existent team", async () => {
      const updatedTeamData = {
        name: "This Won't Work",
        description: "Because the team doesn't exist",
      };
      const {
        body: { msg },
      } = await request(app)
        .patch("/api/teams/9999")
        .send(updatedTeamData)
        .expect(404);
      expect(msg).toBe("Team not found");
    });

    // Additional tests for validation logic
    test("Should reject update when name is missing", async () => {
      const missingNameData = {
        description: "This team update will fail because name is missing",
      };

      const response = await request(app)
        .patch("/api/teams/1")
        .send(missingNameData)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Team name is required");
    });

    test("Should reject update with empty request body", async () => {
      const response = await request(app)
        .patch("/api/teams/1")
        .send({})
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Team name is required");
    });
  });
  describe("DELETE /api/teams/:id - Team Deletion", () => {
    test("Should successfully delete a team with valid ID", async () => {
      // Create a team to delete
      const newTeam = {
        name: "Team To Delete",
        description: "This team will be deleted",
      };
      const createResponse = await request(app)
        .post("/api/teams")
        .send(newTeam);
      const teamIdToDelete = createResponse.body.newTeam.id;
      // Delete the team
      await request(app).delete(`/api/teams/${teamIdToDelete}`).expect(204);
      // Verify the team is deleted
      await request(app).get(`/api/teams/${teamIdToDelete}`).expect(404);
    });
    test("Should return appropriate error when attempting to delete non-existent team", async () => {
      const {
        body: { msg },
      } = await request(app).delete("/api/teams/9999").expect(404);
      expect(msg).toBe("Team not found");
    });
  });
});

describe("Tickets API Endpoints", () => {
  describe("GET /api/tickets - Ticket Listing", () => {
    test("Should successfully retrieve a list of all tickets", async () => {
      const {
        body: { tickets },
      } = await request(app).get("/api/tickets").expect(200);
      expect(tickets).toBeInstanceOf(Array);
      expect(tickets.length).toBeGreaterThanOrEqual(1);

      tickets.forEach((ticket: TicketResponse) => {
        expect(ticket).toHaveProperty("id", expect.any(Number));
        expect(ticket).toHaveProperty("event_id", expect.any(Number));
        expect(ticket).toHaveProperty("user_id", expect.any(Number));
        expect(ticket).toHaveProperty("registration_id", expect.any(Number));
        expect(ticket).toHaveProperty("ticket_code", expect.any(String));
        expect(ticket).toHaveProperty("status", expect.any(String));
      });
    });

    describe("GET /api/tickets/:id - Ticket Lookup by ID", () => {
      test("Should successfully retrieve a ticket when provided a valid ID", async () => {
        const {
          body: { ticket },
        } = await request(app).get("/api/tickets/1").expect(200);
        expect(ticket).toHaveProperty("id", 1);
        expect(ticket).toHaveProperty("event_id", expect.any(Number));
        expect(ticket).toHaveProperty("user_id", expect.any(Number));
        expect(ticket).toHaveProperty("ticket_code", expect.any(String));
      });

      test("Should return appropriate error when ticket ID does not exist", async () => {
        const {
          body: { msg },
        } = await request(app).get("/api/tickets/9999").expect(404);
        expect(msg).toBe("Ticket not found");
      });
    });

    describe("GET /api/tickets/user/:userId - Tickets by User ID", () => {
      test("Should successfully retrieve tickets for a valid user", async () => {
        const {
          body: { tickets },
        } = await request(app).get("/api/tickets/user/3").expect(200);
        expect(tickets).toBeInstanceOf(Array);

        if (tickets.length > 0) {
          tickets.forEach((ticket: TicketWithEventInfo) => {
            expect(ticket.user_id).toBe(3);
            expect(ticket).toHaveProperty("event_title", expect.any(String));
          });
        }
      });

      test("Should return appropriate error when user does not exist", async () => {
        const {
          body: { msg },
        } = await request(app).get("/api/tickets/user/9999").expect(404);
        expect(msg).toBe("User not found");
      });
    });

    describe("GET /api/tickets/verify/:ticketCode - Ticket Verification", () => {
      test("Should successfully verify a valid ticket", async () => {
        // First, get a valid ticket code from the tickets listing
        const {
          body: { tickets },
        } = await request(app).get("/api/tickets").expect(200);

        // Find a valid ticket
        const validTicket = tickets.find(
          (ticket: TicketResponse) => ticket.status === "valid"
        );

        if (validTicket) {
          const {
            body: { status, msg },
          } = await request(app)
            .get(`/api/tickets/verify/${validTicket.ticket_code}`)
            .expect(200);

          expect(status).toBe("success");
          expect(msg).toBe("Ticket is valid");
        } else {
          // Skip test if no valid tickets are found
          console.log("No valid tickets found for verification test");
        }
      });

      test("Should return appropriate error when ticket code does not exist", async () => {
        const {
          body: { msg },
        } = await request(app)
          .get("/api/tickets/verify/nonexistentticketcode123")
          .expect(404);
        expect(msg).toBe("Ticket not found");
      });

      test("Should reject verification for tickets with non-valid status", async () => {
        // Create a ticket first
        const newTicket = {
          event_id: 1,
          user_id: 2,
          registration_id: 1,
        };

        const createResponse = await request(app)
          .post("/api/tickets")
          .send(newTicket)
          .expect(201);

        const ticketId = createResponse.body.ticket.id;
        const ticketCode = createResponse.body.ticket.ticket_code;

        // Update the ticket to a non-valid status
        await request(app)
          .patch(`/api/tickets/${ticketId}`)
          .send({ status: "cancelled" })
          .expect(200);

        // Now try to verify the cancelled ticket
        const verifyResponse = await request(app)
          .get(`/api/tickets/verify/${ticketCode}`)
          .expect(400);

        expect(verifyResponse.body.status).toBe("error");
        expect(verifyResponse.body.msg).toBe("Ticket is cancelled");
      });

      test("Should reject verification for tickets to events that have already ended", async () => {
        // Create a ticket
        const newTicket = {
          event_id: 1,
          user_id: 2,
          registration_id: 1,
        };

        const createResponse = await request(app)
          .post("/api/tickets")
          .send(newTicket)
          .expect(201);

        const ticketCode = createResponse.body.ticket.ticket_code;

        // Mock the event end_time to be in the past
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1); // Yesterday

        // Store the original implementation
        const originalFetchTicketByCode = ticketModels.fetchTicketByCode;

        // Use jest spyOn to intercept the fetchTicketByCode call and modify the response
        const spy = jest
          .spyOn(ticketModels, "fetchTicketByCode")
          .mockImplementation(async () => {
            const ticket = await originalFetchTicketByCode(ticketCode);
            return {
              ...ticket,
              end_time: pastDate.toISOString(),
            };
          });

        try {
          // Now try to verify the ticket for an event that has ended
          const verifyResponse = await request(app)
            .get(`/api/tickets/verify/${ticketCode}`)
            .expect(400);

          expect(verifyResponse.body.status).toBe("error");
          expect(verifyResponse.body.msg).toBe("Event has already ended");
        } finally {
          // Restore the original function
          spy.mockRestore();
        }
      });
    });
  });

  describe("POST /api/tickets - Ticket Creation", () => {
    test("Should successfully create a new ticket with valid details", async () => {
      const newTicket = {
        event_id: 1,
        user_id: 1,
        registration_id: 1,
      };

      const {
        body: { status, msg, ticket },
      } = await request(app).post("/api/tickets").send(newTicket).expect(201);

      expect(status).toBe("success");
      expect(msg).toBe("Ticket created successfully");
      expect(ticket).toHaveProperty("id", expect.any(Number));
      expect(ticket).toHaveProperty("ticket_code", expect.any(String));
      expect(ticket).toHaveProperty("status", "valid");
      expect(ticket.event_id).toBe(newTicket.event_id);
      expect(ticket.user_id).toBe(newTicket.user_id);
      expect(ticket.registration_id).toBe(newTicket.registration_id);
    });

    test("Should reject ticket creation when required fields are missing", async () => {
      const {
        body: { status, msg, errors },
      } = await request(app).post("/api/tickets").send({}).expect(400);

      expect(status).toBe("error");
      expect(msg).toBe("Missing required fields");
      expect(errors).toContain("Event ID is required");
      expect(errors).toContain("User ID is required");
      expect(errors).toContain("Registration ID is required");
    });
  });

  describe("PATCH /api/tickets/:id - Ticket Status Update", () => {
    test("Should successfully update a ticket status", async () => {
      // Create a ticket to update
      const newTicket = {
        event_id: 1,
        user_id: 2,
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .send(newTicket)
        .expect(201);

      const ticketId = createResponse.body.ticket.id;

      // Update the ticket
      const {
        body: { status, msg, ticket },
      } = await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .send({ status: "cancelled" })
        .expect(200);

      expect(status).toBe("success");
      expect(msg).toBe("Ticket updated successfully");
      expect(ticket.id).toBe(ticketId);
      expect(ticket.status).toBe("cancelled");
    });

    test("Should reject status update with invalid status", async () => {
      const {
        body: { status, msg, validOptions },
      } = await request(app)
        .patch("/api/tickets/1")
        .send({ status: "invalid_status" })
        .expect(400);

      expect(status).toBe("error");
      expect(msg).toBe("Invalid ticket status");
      expect(validOptions).toContain("valid");
      expect(validOptions).toContain("used");
      expect(validOptions).toContain("cancelled");
      expect(validOptions).toContain("expired");
    });
  });

  describe("POST /api/tickets/use/:ticketCode - Mark Ticket as Used", () => {
    test("Should successfully mark a valid ticket as used", async () => {
      // First, create a new ticket
      const newTicket = {
        event_id: 1,
        user_id: 3,
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .send(newTicket)
        .expect(201);

      const ticketCode = createResponse.body.ticket.ticket_code;

      // Mark the ticket as used
      const {
        body: { status, msg, ticket },
      } = await request(app).post(`/api/tickets/use/${ticketCode}`).expect(200);

      expect(status).toBe("success");
      expect(msg).toBe("Ticket marked as used");
      expect(ticket.ticket_code).toBe(ticketCode);
      expect(ticket.status).toBe("used");
      expect(ticket.used_at).not.toBeNull();
    });

    test("Should return appropriate error when ticket code does not exist", async () => {
      const {
        body: { msg },
      } = await request(app)
        .post("/api/tickets/use/nonexistentticketcode123")
        .expect(404);
      expect(msg).toBe("Ticket not found");
    });

    test("Should reject attempt to use a ticket that has already been used", async () => {
      // First, create a new ticket
      const newTicket = {
        event_id: 1,
        user_id: 3,
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .send(newTicket)
        .expect(201);

      const ticketCode = createResponse.body.ticket.ticket_code;

      // Mark the ticket as used - first time
      await request(app).post(`/api/tickets/use/${ticketCode}`).expect(200);

      // Try to use the same ticket again
      const secondUseResponse = await request(app)
        .post(`/api/tickets/use/${ticketCode}`)
        .expect(400);

      expect(secondUseResponse.body.status).toBe("error");
      expect(secondUseResponse.body.msg).toBe("Ticket has already been used");
      expect(secondUseResponse.body).toHaveProperty("usedAt");
    });

    test("Should reject attempt to use a ticket with non-valid status", async () => {
      // First, create a new ticket
      const newTicket = {
        event_id: 1,
        user_id: 3,
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .send(newTicket)
        .expect(201);

      const ticketId = createResponse.body.ticket.id;
      const ticketCode = createResponse.body.ticket.ticket_code;

      // Update the ticket to a non-valid status (e.g., cancelled)
      await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .send({ status: "cancelled" })
        .expect(200);

      // Try to use the cancelled ticket
      const useResponse = await request(app)
        .post(`/api/tickets/use/${ticketCode}`)
        .expect(400);

      expect(useResponse.body.status).toBe("error");
      expect(useResponse.body.msg).toBe(
        "Cannot use ticket with status: cancelled"
      );
    });
  });

  describe("DELETE /api/tickets/:id - Ticket Deletion", () => {
    test("Should successfully delete a ticket with valid ID", async () => {
      // Create a ticket to delete
      const newTicket = {
        event_id: 1,
        user_id: 2,
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .send(newTicket)
        .expect(201);

      const ticketIdToDelete = createResponse.body.ticket.id;

      // Delete the ticket
      await request(app).delete(`/api/tickets/${ticketIdToDelete}`).expect(204);

      // Verify the ticket is deleted
      await request(app).get(`/api/tickets/${ticketIdToDelete}`).expect(404);
    });

    test("Should return appropriate error when attempting to delete non-existent ticket", async () => {
      const {
        body: { msg },
      } = await request(app).delete("/api/tickets/9999").expect(404);
      expect(msg).toBe("Ticket not found");
    });
  });
});

// Event Registration Tests
describe("Event Registration API", () => {
  let testEvent: EventResponse;
  let testUser: { id: number; username: string; email: string };
  let pastEvent: EventResponse;
  let fullEvent: EventResponse;
  let draftEvent: EventResponse;

  // Setup - create test events and user
  beforeEach(async () => {
    // Create a test user
    const userResponse = await request(app).post("/api/users").send({
      username: "registrationtester",
      email: "registrationtester@example.com",
      plainPassword: "password123",
    });
    testUser = userResponse.body.newUser;

    // Create a standard future event
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const eventResponse = await request(app).post("/api/events").send({
      status: "published",
      title: "Test Registration Event",
      description: "An event for testing registrations",
      location: "Test Location",
      start_time: tomorrow.toISOString(),
      end_time: dayAfterTomorrow.toISOString(),
      max_attendees: 10,
      price: 0,
      event_type: "workshop",
      is_public: true,
    });
    testEvent = eventResponse.body.event;

    // Create a past event
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const pastEventResponse = await request(app).post("/api/events").send({
      status: "published",
      title: "Past Test Event",
      description: "An event that's already happened",
      start_time: lastWeek.toISOString(),
      end_time: yesterday.toISOString(),
      is_public: true,
    });
    pastEvent = pastEventResponse.body.event;

    // Create a full event (max_attendees = 1)
    const fullEventResponse = await request(app).post("/api/events").send({
      status: "published",
      title: "Full Test Event",
      description: "An event with limited capacity",
      start_time: tomorrow.toISOString(),
      end_time: dayAfterTomorrow.toISOString(),
      max_attendees: 1,
      is_public: true,
    });
    fullEvent = fullEventResponse.body.event;

    // Create a draft event
    const draftEventResponse = await request(app).post("/api/events").send({
      status: "draft",
      title: "Draft Test Event",
      description: "An event that's not published yet",
      start_time: tomorrow.toISOString(),
      end_time: dayAfterTomorrow.toISOString(),
      is_public: true,
    });
    draftEvent = draftEventResponse.body.event;

    // Register another user for the full event to reach capacity
    const otherUserResponse = await request(app).post("/api/users").send({
      username: "capacityuser",
      email: "capacity@example.com",
      plainPassword: "password123",
    });

    // Output the structure to console for debugging
    console.log(
      "Other user response:",
      JSON.stringify(otherUserResponse.body, null, 2)
    );

    // Only try to register if user creation was successful
    if (
      otherUserResponse.statusCode === 201 &&
      otherUserResponse.body.newUser
    ) {
      const otherUser = otherUserResponse.body.newUser;

      // Fill up the full event
      await request(app)
        .post(`/api/events/${fullEvent.id}/register`)
        .send({ userId: otherUser.id });
    } else {
      console.log(
        "Skipping capacity user registration due to user creation failure"
      );
    }
  });

  describe("Event Availability", () => {
    test("Check event availability returns available for a published future event", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(
        app
      ).get(`/api/events/${testEvent.id}/availability`);

      expect(body.available).toBe(true);
    });

    test("Event should be unavailable when it has already started", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(
        app
      ).get(`/api/events/${pastEvent.id}/availability`);

      expect(body.available).toBe(false);
      expect(body.reason).toBe("Event has already started");
    });

    test("Event should be unavailable when it is not published", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(
        app
      ).get(`/api/events/${draftEvent.id}/availability`);

      expect(body.available).toBe(false);
      expect(body.reason).toBe("Event is draft, not published");
    });

    test("Event should be unavailable when it has reached max capacity", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(
        app
      ).get(`/api/events/${fullEvent.id}/availability`);

      expect(body.available).toBe(false);
      expect(body.reason).toBe("Event has reached maximum attendee capacity");
    });

    test("Should properly handle errors when checking non-existent event availability", async () => {
      const response = await request(app)
        .get("/api/events/9999/availability")
        .expect(404);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Event not found");
    });

    test("Should handle malformed event IDs in availability checks", async () => {
      const response = await request(app)
        .get(`/api/events/${testEvent.id}abc/availability`)
        .expect(400);

      expect(response.body).toHaveProperty("msg");

      // Also test non-numeric ID
      const nonNumericResponse = await request(app)
        .get("/api/events/NaN/availability")
        .expect(400);

      expect(nonNumericResponse.body).toHaveProperty("msg");
    });
  });

  describe("Event Registration", () => {
    test("User can register for an available event", async () => {
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: testUser.id });

      const registration: EventRegistrationResponse =
        response.body.registration;

      expect(response.status).toBe(201);
      expect(response.body.msg).toBe("Registration successful");
      expect(registration.event_id).toBe(testEvent.id);
      expect(registration.user_id).toBe(testUser.id);
      expect(registration.status).toBe("registered");
    });

    test("User cannot register twice for the same event", async () => {
      // First registration
      await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: testUser.id });

      // Try to register again
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: testUser.id });

      expect(response.status).toBe(400);
      expect(response.body.msg).toBe(
        "User is already registered for this event"
      );
    });

    test("Cannot register for events with unavailable status", async () => {
      // Try to register for past event
      const pastResponse = await request(app)
        .post(`/api/events/${pastEvent.id}/register`)
        .send({ userId: testUser.id });

      expect(pastResponse.status).toBe(400);
      expect(pastResponse.body.msg).toBe("Event has already started");

      // Try to register for draft event
      const draftResponse = await request(app)
        .post(`/api/events/${draftEvent.id}/register`)
        .send({ userId: testUser.id });

      expect(draftResponse.status).toBe(400);
      expect(draftResponse.body.msg).toBe("Event is draft, not published");

      // Try to register for full event
      const fullResponse = await request(app)
        .post(`/api/events/${fullEvent.id}/register`)
        .send({ userId: testUser.id });

      expect(fullResponse.status).toBe(400);
      expect(fullResponse.body.msg).toBe(
        "Event has reached maximum attendee capacity"
      );
    });

    test("Cannot register with invalid user information", async () => {
      // Missing user ID
      const missingUserResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({});

      expect(missingUserResponse.status).toBe(400);
      expect(missingUserResponse.body.msg).toBe("User ID is required");

      // Non-existent user ID
      const nonExistentUserResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: 9999 });

      expect(nonExistentUserResponse.status).toBe(400);
      expect(nonExistentUserResponse.body.msg).toBe("Bad request");
    });
  });

  describe("Registration Management", () => {
    test("User can cancel registration", async () => {
      // Register first
      const registerResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: testUser.id });

      const registrationId = registerResponse.body.registration.id;

      // Cancel registration
      const response = await request(app).patch(
        `/api/events/registrations/${registrationId}/cancel`
      );

      const registration: EventRegistrationResponse =
        response.body.registration;

      expect(response.status).toBe(200);
      expect(response.body.msg).toBe("Registration cancelled successfully");
      expect(registration.status).toBe("cancelled");
    });

    test("User can reactivate a cancelled registration", async () => {
      // Register first
      const registerResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: testUser.id });

      const registrationId = registerResponse.body.registration.id;

      // Cancel registration
      await request(app).patch(
        `/api/events/registrations/${registrationId}/cancel`
      );

      // Try to register again (should reactivate)
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: testUser.id });

      const registration: EventRegistrationResponse =
        response.body.registration;

      expect(response.status).toBe(201);
      expect(response.body.msg).toBe("Registration reactivated successfully");
      expect(registration.status).toBe("registered");
      expect(registration.reactivated).toBe(true);
    });

    test("Cannot cancel an already cancelled registration", async () => {
      // First register
      const registerResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: testUser.id });

      const registrationId = registerResponse.body.registration.id;

      // Cancel once
      await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .expect(200);

      // Try to cancel again
      const secondCancelResponse = await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .expect(400);

      expect(secondCancelResponse.body.msg).toBe(
        "Registration is already cancelled"
      );
    });

    test("Should return 404 when cancelling a non-existent registration", async () => {
      const response = await request(app).patch(
        "/api/events/registrations/9999/cancel"
      );

      expect(response.status).toBe(404);
      expect(response.body.msg).toBe("Registration not found");
    });
  });

  describe("Registration Listing", () => {
    test("Should get event registrations for an event", async () => {
      // First register a user
      await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .send({ userId: testUser.id });

      // Now get registrations
      const response = await request(app)
        .get(`/api/events/${testEvent.id}/registrations`)
        .expect(200);

      expect(response.body).toHaveProperty("registrations");
      expect(response.body.registrations).toBeInstanceOf(Array);
      expect(response.body.registrations.length).toBeGreaterThanOrEqual(1);

      const registration = response.body.registrations[0];
      expect(registration).toHaveProperty("id", expect.any(Number));
      expect(registration).toHaveProperty("event_id", testEvent.id);
      expect(registration).toHaveProperty("user_id", expect.any(Number));
      expect(registration).toHaveProperty("username", expect.any(String));
      expect(registration).toHaveProperty("email", expect.any(String));
    });

    test("Should return empty array when getting registrations for an event with no registrations", async () => {
      // Get registrations for an event that should have no registrations yet
      const response = await request(app)
        .get(`/api/events/${draftEvent.id}/registrations`)
        .expect(200);

      expect(response.body).toHaveProperty("registrations");
      expect(response.body.registrations).toBeInstanceOf(Array);
      expect(response.body.registrations.length).toBe(0);
    });
  });
});

// Add Event CRUD API tests
describe("Events API Endpoints", () => {
  describe("GET /api/events - Event Listing", () => {
    test("Should successfully retrieve a list of all events", async () => {
      const {
        body: { events },
      } = await request(app).get("/api/events").expect(200);
      expect(events).toBeInstanceOf(Array);
      expect(events.length).toBeGreaterThanOrEqual(1);

      events.forEach((event: EventResponse) => {
        expect(event).toHaveProperty("id", expect.any(Number));
        expect(event).toHaveProperty("title", expect.any(String));
        expect(event).toHaveProperty("status", expect.any(String));
      });
    });
  });

  describe("GET /api/events/:id - Event Lookup by ID", () => {
    test("Should successfully retrieve an event when provided a valid ID", async () => {
      const {
        body: { event },
      }: { body: { event: EventResponse } } = await request(app)
        .get("/api/events/1")
        .expect(200);
      expect(event).toHaveProperty("id", 1);
      expect(event).toHaveProperty("title", expect.any(String));
      expect(event).toHaveProperty("status", expect.any(String));
    });

    test("Should return appropriate error when event ID does not exist", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/events/9999").expect(404);
      expect(msg).toBe("Event not found");
    });
  });

  describe("GET /api/events/upcoming - Upcoming Events", () => {
    test("Should successfully retrieve upcoming events", async () => {
      const {
        body: { events },
      } = await request(app).get("/api/events/upcoming").expect(200);
      expect(events).toBeInstanceOf(Array);

      // If there are upcoming events, check their properties
      if (events.length > 0) {
        events.forEach((event: any) => {
          expect(event).toHaveProperty("id", expect.any(Number));
          expect(event).toHaveProperty("title", expect.any(String));
          expect(event.status).toBe("published");

          // Verify that start_time is in the future
          const startTime = new Date(event.start_time);
          expect(startTime.getTime()).toBeGreaterThan(Date.now());
        });
      }
    });

    test("Should limit results when limit parameter is provided", async () => {
      const limit = 2;
      const {
        body: { events },
      } = await request(app)
        .get(`/api/events/upcoming?limit=${limit}`)
        .expect(200);

      // Verify limit is respected (if there are enough events)
      expect(events.length).toBeLessThanOrEqual(limit);
    });
  });

  describe("GET /api/events/team/:teamId - Events by Team ID", () => {
    test("Should successfully retrieve events for a valid team ID", async () => {
      const {
        body: { events },
      } = await request(app).get("/api/events/team/1").expect(200);
      expect(events).toBeInstanceOf(Array);

      // If there are events for this team, check they all have the right team_id
      if (events.length > 0) {
        events.forEach((event: any) => {
          expect(event.team_id).toBe(1);
        });
      }
    });
  });

  describe("POST /api/events - Event Creation", () => {
    test("Should successfully create a new event with valid details", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const newEvent = {
        status: "draft",
        title: "New Test Event",
        description: "This is a test event created by the API test",
        location: "Test Location",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
        max_attendees: 50,
        price: 10.0,
        event_type: "conference",
        is_public: true,
      };

      const response = await request(app)
        .post("/api/events")
        .send(newEvent)
        .expect(201);

      const event: EventResponse = response.body.event;
      expect(event.title).toBe(newEvent.title);
      expect(event.status).toBe(newEvent.status);
      expect(event.max_attendees).toBe(newEvent.max_attendees);
      expect(event.price).toBe(newEvent.price);
    });

    test("Should reject event creation when required fields are missing", async () => {
      const incompleteEvent = {
        description: "This event is missing required fields",
      };

      const response = await request(app)
        .post("/api/events")
        .send(incompleteEvent)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Missing required fields");
      expect(response.body.errors).toContain("Event title is required");
      expect(response.body.errors).toContain("Start time is required");
      expect(response.body.errors).toContain("End time is required");
    });

    test("Should reject event creation when end time is before start time", async () => {
      const invalidTimeEvent = {
        title: "Invalid Time Event",
        description: "This event has end time before start time",
        start_time: new Date(2023, 12, 15).toISOString(),
        end_time: new Date(2023, 12, 10).toISOString(),
      };

      const response = await request(app)
        .post("/api/events")
        .send(invalidTimeEvent)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("End time must be after start time");
    });

    test("Should handle default values and optional fields correctly", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Test with minimal required fields
      const minimalEvent = {
        title: "Minimal Event",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
      };

      const response = await request(app)
        .post("/api/events")
        .send(minimalEvent)
        .expect(201);

      expect(response.body.event.title).toBe("Minimal Event");
      expect(response.body.event.status).toBe("draft"); // Default status
      expect(response.body.event.is_public).toBe(true); // Default is_public
      expect(response.body.event.description).toBeNull();
      expect(response.body.event.location).toBeNull();
      expect(response.body.event.max_attendees).toBeNull();
      expect(response.body.event.price).toBeNull();
      expect(response.body.event.event_type).toBeNull();

      // Test with explicit null values
      const eventWithNulls = {
        title: "Event With Explicit Nulls",
        description: null,
        location: null,
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
        max_attendees: null,
        price: null,
        event_type: null,
        is_public: true,
      };

      const nullResponse = await request(app)
        .post("/api/events")
        .send(eventWithNulls)
        .expect(201);

      expect(nullResponse.body.event.title).toBe("Event With Explicit Nulls");
      expect(nullResponse.body.event.description).toBeNull();
      expect(nullResponse.body.event.location).toBeNull();
      expect(nullResponse.body.event.max_attendees).toBeNull();
      expect(nullResponse.body.event.price).toBeNull();
      expect(nullResponse.body.event.event_type).toBeNull();
    });
  });

  describe("PATCH /api/events/:id - Event Update", () => {
    test("Should successfully update an event with valid details", async () => {
      // First, create an event to update
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const newEvent = {
        status: "draft",
        title: "Event to Update",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
      };

      const createResponse = await request(app)
        .post("/api/events")
        .send(newEvent)
        .expect(201);

      const eventId = createResponse.body.event.id;

      // Now update the event
      const updateData = {
        title: "Updated Event Title",
        description: "This description was added in an update",
        status: "published",
      };

      const response = await request(app)
        .patch(`/api/events/${eventId}`)
        .send(updateData)
        .expect(200);

      const event: EventResponse = response.body.event;
      expect(event.id).toBe(eventId);
      expect(event.title).toBe(updateData.title);
      expect(event.description).toBe(updateData.description);
      expect(event.status).toBe(updateData.status);
    });

    test("Should return appropriate error when updating non-existent event", async () => {
      const updateData = {
        title: "This Won't Work",
        status: "published",
      };

      const response = await request(app)
        .patch("/api/events/9999")
        .send(updateData)
        .expect(404);

      expect(response.body.msg).toBe("Event not found");
    });

    test("Should reject update when end time is before start time", async () => {
      // Get an existing event ID
      const {
        body: { events },
      } = await request(app).get("/api/events").expect(200);
      const eventId = events[0].id;

      // Try to update with invalid times
      const invalidTimeUpdate = {
        start_time: new Date(2023, 12, 15).toISOString(),
        end_time: new Date(2023, 12, 10).toISOString(),
      };

      const response = await request(app)
        .patch(`/api/events/${eventId}`)
        .send(invalidTimeUpdate)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("End time must be after start time");
    });

    test("Should handle different field types and conversions during update", async () => {
      // First, create an event to update
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const newEvent = {
        title: "Comprehensive Update Test Event",
        description: "Original description",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
        max_attendees: 10,
        is_public: true,
      };

      const createResponse = await request(app)
        .post("/api/events")
        .send(newEvent)
        .expect(201);

      const eventId = createResponse.body.event.id;

      // New dates for update
      const newStart = new Date();
      newStart.setDate(newStart.getDate() + 3); // 3 days from now

      const newEnd = new Date();
      newEnd.setDate(newStart.getDate() + 10); // 10 days from now

      // Update with mix of field types
      const updateData = {
        title: "Updated Event Title",
        description: "Updated description",
        status: "published",
        max_attendees: "25", // String version of a number
        price: 29.99, // Number
        is_public: false, // Boolean
        start_time: newStart.toISOString(),
        end_time: newEnd.toISOString(),
      };

      const response = await request(app)
        .patch(`/api/events/${eventId}`)
        .send(updateData)
        .expect(200);

      // Check all fields were updated correctly
      const event: EventResponse = response.body.event;
      expect(event.title).toBe(updateData.title);
      expect(event.description).toBe(updateData.description);
      expect(event.status).toBe(updateData.status);
      expect(event.max_attendees).toBe(25); // Converted to number
      expect(event.price).toBe(updateData.price);
      expect(event.is_public).toBe(updateData.is_public);

      // Check updated times (within 1 minute tolerance for testing)
      const updatedStartTime = new Date(event.start_time);
      const updatedEndTime = new Date(event.end_time);
      expect(
        Math.abs(updatedStartTime.getTime() - newStart.getTime())
      ).toBeLessThan(60000);
      expect(
        Math.abs(updatedEndTime.getTime() - newEnd.getTime())
      ).toBeLessThan(60000);
    });
  });

  describe("DELETE /api/events/:id - Event Deletion", () => {
    test("Should successfully delete an event with valid ID", async () => {
      // First, create an event to delete
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const newEvent = {
        title: "Event to Delete",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
      };

      const createResponse = await request(app)
        .post("/api/events")
        .send(newEvent)
        .expect(201);

      const eventId = createResponse.body.event.id;

      // Now delete the event
      await request(app).delete(`/api/events/${eventId}`).expect(204);

      // Verify the event is deleted
      await request(app).get(`/api/events/${eventId}`).expect(404);
    });

    test("Should return appropriate error when deleting non-existent event", async () => {
      const response = await request(app)
        .delete("/api/events/9999")
        .expect(404);

      expect(response.body.msg).toBe("Event not found");
    });
  });
});
