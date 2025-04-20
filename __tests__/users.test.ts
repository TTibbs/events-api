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
  stripePayments,
  categories,
} from "../db/data/test-data/index";
import { User } from "../types";
import { getAuthToken } from "../utils/testHelpers";

// Token variables
let aliceToken: string;
let bobToken: string;
let charlieToken: string;
let siteadminToken: string;
let regularuserToken: string;

// Initialize tokens before all tests
beforeAll(async () => {
  aliceToken = await getAuthToken("alice123");
  bobToken = await getAuthToken("bob123");
  charlieToken = await getAuthToken("charlie123");
  siteadminToken = await getAuthToken("siteadmin");
  regularuserToken = await getAuthToken("regularuser");
});

beforeEach(() =>
  seed({
    users,
    events,
    eventRegistrations,
    teamMembers,
    userSessions,
    teams,
    tickets,
    stripePayments,
    categories,
  })
);

afterAll(async () => {
  await db.end();
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
        expect(user).toHaveProperty("profile_image_url", expect.any(String));
        expect(user).toHaveProperty("is_site_admin", expect.any(Boolean));
        expect(user.stripe_customer_id).toBeNull();
        expect(user).toHaveProperty("created_at", expect.any(String));
        expect(user).toHaveProperty("updated_at", expect.any(String));
        expect(user.teams).toBeInstanceOf(Array);
      });
    });
    test("Should return the total number of users", async () => {
      const {
        body: { total_users },
      } = await request(app).get("/api/users").expect(200);
      expect(total_users).toBe(5);
    });
  });
  describe("GET /api/users/:id - User Lookup by ID", () => {
    test("Should successfully retrieve a user when provided a valid ID", async () => {
      const {
        body: { user },
      } = await request(app).get("/api/users/1").expect(200);
      expect(user).toHaveProperty("id", 1);
      expect(user).toHaveProperty("username", "alice123");
      expect(user).toHaveProperty("email", "alice@example.com");
      expect(user).toHaveProperty("profile_image_url", expect.any(String));
      expect(user).toHaveProperty("is_site_admin", false);
      expect(user.stripe_customer_id).toBeNull();
      expect(user).toHaveProperty("created_at", expect.any(String));
      expect(user).toHaveProperty("updated_at", expect.any(String));
      expect(user.teams).toBeInstanceOf(Array);
    });
    test("Should return appropriate error when user ID does not exist", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/users/9999").expect(404);
      expect(msg).toBe("User not found");
    });
    test("Should return error when user ID is not a number", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/users/notanumber").expect(400);
      expect(msg).toBe("Invalid user ID");
    });
  });
  describe("GET /api/users/username/:username - User Lookup by Username", () => {
    test("Should successfully retrieve a user when provided a valid username", async () => {
      const {
        body: { user },
      } = await request(app).get("/api/users/username/alice123").expect(200);
      expect(user).toHaveProperty("id", 1);
      expect(user).toHaveProperty("username", "alice123");
      expect(user).toHaveProperty("email", "alice@example.com");
      expect(user).toHaveProperty("profile_image_url", expect.any(String));
      expect(user).toHaveProperty("is_site_admin", false);
      expect(user.stripe_customer_id).toBeNull();
      expect(user).toHaveProperty("created_at", expect.any(String));
      expect(user).toHaveProperty("updated_at", expect.any(String));
      expect(user.teams).toBeInstanceOf(Array);
    });
    test("Should return appropriate error when username does not exist", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/users/username/nonexistent").expect(404);
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
      expect(user).toHaveProperty("username", "alice123");
      expect(user).toHaveProperty("email", "alice@example.com");
      expect(user).toHaveProperty("profile_image_url", expect.any(String));
      expect(user).toHaveProperty("is_site_admin", false);
      expect(user.stripe_customer_id).toBeNull();
      expect(user).toHaveProperty("created_at", expect.any(String));
      expect(user).toHaveProperty("updated_at", expect.any(String));
      expect(user.teams).toBeInstanceOf(Array);
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
  describe("GET /api/users/:id/registrations - User Event Registrations", () => {
    test("Should successfully retrieve event registrations for a user", async () => {
      const { body } = await request(app)
        .get("/api/users/1/registrations")
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(200);
      expect(body.status).toBe("success");
      expect(body.registrations).not.toHaveLength(0);
    });
    test("Should return empty array for user with no registrations", async () => {
      const { body } = await request(app)
        .get(`/api/users/5/registrations`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(200);

      expect(body).toHaveProperty("status", "success");
      expect(body).toHaveProperty("registrations");
      expect(body.registrations).toBeInstanceOf(Array);
      expect(body.registrations).toHaveLength(0);
    });
    test("Should return 404 for non-existent user", async () => {
      const { body } = await request(app)
        .get("/api/users/9999/registrations")
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(404);
      expect(body).toHaveProperty("msg", "User not found");
    });
    test("Should require authentication", async () => {
      const { body } = await request(app)
        .get("/api/users/1/registrations")
        .expect(401);

      expect(body).toHaveProperty("status", "error");
      expect(body.msg).toBe("Unauthorized - No token provided");
    });
  });
  describe("GET /api/users/:id/is-site-admin - User Site Admin Check", () => {
    test("Should return true for site admin", async () => {
      const { body } = await request(app)
        .get("/api/users/4/is-site-admin")
        .set("Authorization", `Bearer ${siteadminToken}`)
        .expect(200);
      expect(body).toHaveProperty("is_site_admin", true);
    });
    test("Should return false for non-site admin", async () => {
      const { body } = await request(app)
        .get("/api/users/2/is-site-admin")
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(200);

      expect(body).toHaveProperty("is_site_admin", false);
    });
    test("Should return 404 for non-existent user", async () => {
      const { body } = await request(app)
        .get("/api/users/9999/is-site-admin")
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(404);

      expect(body).toHaveProperty("msg", "User not found");
    });
    test("Should require authentication", async () => {
      const { body } = await request(app)
        .get("/api/users/1/is-site-admin")
        .expect(401);

      expect(body).toHaveProperty("status", "error");
      expect(body.msg).toBe("Unauthorized - No token provided");
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
      expect(newUser).toHaveProperty("is_site_admin", false);
      expect(newUser.profile_image_url).toBeNull();
      expect(newUser.stripe_customer_id).toBeNull();
      expect(newUser).toHaveProperty("created_at", expect.any(String));
      expect(newUser).toHaveProperty("updated_at", expect.any(String));
      expect(newUser.teams).toBeInstanceOf(Array);
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
        .send({})
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
    test("Should accept partial updates to a user profile", async () => {
      const token = await getAuthToken();
      const { body } = await request(app)
        .patch(`/api/users/1`)
        .set("Authorization", `Bearer ${token}`)
        .send({ profile_image_url: "https://example.com/profile.jpg" })
        .expect(200);

      expect(body.status).toBe("success");
      expect(body.msg).toBe("User updated successfully");
      expect(body.user.profile_image_url).toBe(
        "https://example.com/profile.jpg"
      );
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
      const token = await getAuthToken("bob123");
      const { body } = await request(app)
        .patch(`/api/users/2`)
        .set("Authorization", `Bearer ${token}`)
        .send({ username: "alice123" })
        .expect(409);
      expect(body.status).toBe("error");
      expect(body.msg).toBe("Username already exists");
    });
  });
  describe("DELETE /api/users/:id - User Deletion", () => {
    test("Should successfully delete a user with valid ID and authentication", async () => {
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

      const token = await getAuthToken();

      await request(app)
        .delete(`/api/users/${userId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      await request(app).get(`/api/users/${userId}`).expect(404);
    });
    test("Should reject user deletion when not authenticated", async () => {
      // Try to delete a user without authentication
      const response = await request(app).delete("/api/users/1").expect(401);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("Unauthorized - No token provided");
    });
  });
});
