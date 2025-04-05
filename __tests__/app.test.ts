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
  Ticket,
  TicketResponse,
  TicketWithEventInfo,
  TicketWithUserInfo,
} from "../types";
import * as ticketModels from "../models/tickets-models";
require("jest-sorted");

// Get the refresh tokens from the user sessions for testing
const refreshToken1 = userSessions[0].refresh_token;

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
        password_hash: "password123",
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
        .send({ email: "test@example.com", password_hash: "password123" })
        .expect(400);
      expect(msg).toBe("Username is required");
    });
    test("Should reject user creation when email is missing", async () => {
      const {
        body: { msg },
      } = await request(app)
        .post("/api/users")
        .send({ username: "testuser", password_hash: "password123" })
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
        password_hash: "password123",
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
        password_hash: "password123",
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
        password_hash: "password123",
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
        // password_hash is missing
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
        password_hash: "password123",
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
    });

    test("Should reject team member creation when neither user_id nor new user details are provided", async () => {
      const invalidTeamMember = {
        // No user_id or username/email/password
        team_id: 1,
        role: "member",
      };

      const response = await request(app)
        .post("/api/teams/members")
        .send(invalidTeamMember)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Missing required fields");
      // Should contain multiple error messages
      expect(response.body.errors.length).toBeGreaterThan(0);
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
