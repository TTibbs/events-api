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
import { User } from "../types";
require("jest-sorted");
import { getAuthToken } from "../utils/testHelpers";

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
  describe("GET /api/users/:id/registrations - User Event Registrations", () => {
    test("Should successfully retrieve event registrations for a user", async () => {
      const token = await getAuthToken();

      // Register a user for an event
      // First get a valid event ID
      const eventsResponse = await request(app).get("/api/events");
      const eventId = eventsResponse.body.events[0].id;

      // Register for the event - using default user ID 1 (alice123)
      await request(app)
        .post(`/api/events/${eventId}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 1 });

      // Get user's registrations
      const response = await request(app)
        .get("/api/users/1/registrations")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty("status", "success");
      expect(response.body).toHaveProperty("registrations");
      expect(response.body.registrations).toBeInstanceOf(Array);

      // Check if any registration matches our registered event
      if (response.body.registrations.length > 0) {
        const foundRegistration = response.body.registrations.some(
          (reg: any) => reg.event_id === eventId
        );
        expect(foundRegistration).toBe(true);
      }

      // Verify registration structure
      if (response.body.registrations.length > 0) {
        const registration = response.body.registrations[0];
        expect(registration).toHaveProperty("id", expect.any(Number));
        expect(registration).toHaveProperty("event_id", expect.any(Number));
        expect(registration).toHaveProperty("user_id", expect.any(Number));
        expect(registration).toHaveProperty("status", expect.any(String));
        expect(registration).toHaveProperty("event_title", expect.any(String));
        expect(registration).toHaveProperty("start_time", expect.any(String));
        expect(registration).toHaveProperty("end_time", expect.any(String));
      }
    });
    test("Should return empty array for user with no registrations", async () => {
      const token = await getAuthToken();

      // Create a new user who has no registrations
      const newUserResponse = await request(app).post("/api/users").send({
        username: "noregistrations",
        email: "noregistrations@example.com",
        plainPassword: "password123",
      });

      const newUserId = newUserResponse.body.newUser.id;

      // Get registrations for the new user
      const response = await request(app)
        .get(`/api/users/${newUserId}/registrations`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty("status", "success");
      expect(response.body).toHaveProperty("registrations");
      expect(response.body.registrations).toBeInstanceOf(Array);
      expect(response.body.registrations.length).toBe(0);
    });
    test("Should return 404 for non-existent user", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get("/api/users/9999/registrations")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty("msg", "User not found");
    });
    test("Should require authentication", async () => {
      // Request without auth token
      const response = await request(app)
        .get("/api/users/1/registrations")
        .expect(401);

      expect(response.body).toHaveProperty("status", "error");
      expect(response.body.msg).toBe("Unauthorized - No token provided");
    });
  });
  describe("GET /api/users/:id/is-site-admin - User Site Admin Check", () => {
    test("Should return true for site admin", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get("/api/users/4/is-site-admin")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      console.log(response.body);
      expect(response.body).toHaveProperty("is_site_admin", true);
    });
    test("Should return false for non-site admin", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get("/api/users/2/is-site-admin")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty("is_site_admin", false);
    });
    test("Should return 404 for non-existent user", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get("/api/users/9999/is-site-admin")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty("msg", "User not found");
    });
    test("Should require authentication", async () => {
      // Request without auth token
      const response = await request(app)
        .get("/api/users/1/is-site-admin")
        .expect(401);

      expect(response.body).toHaveProperty("status", "error");
      expect(response.body.msg).toBe("Unauthorized - No token provided");
    });
  });
});
