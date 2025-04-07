// @ts-nocheck
// This file uses ES modules
import {
  describe,
  test,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  beforeEach,
} from "vitest";
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

// Test user credentials and data
const TEST_USER = {
  username: "e2etester",
  email: "e2e@test.com",
  password: "password123",
};

// Store user data and tokens during the test
const testContext = {
  userId: null as number | null,
  accessToken: null as string | null,
  refreshToken: null as string | null,
  eventId: null as number | null,
  registrationId: null as number | null,
  ticketCode: null as string | null,
};

// Reset database before each test suite
beforeAll(async () => {
  await seed({
    users,
    teams,
    events,
    eventRegistrations,
    teamMembers,
    userSessions,
    tickets,
  });
});

// Clean up database connection after all tests
afterAll(async () => {
  await db.end();
});

describe("E2E User Journey Testing", () => {
  describe("1. User Authentication", () => {
    test("User can register for a new account", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send(TEST_USER);

      expect(response.status).toBe(201);
      expect(response.body.status).toBe("success");
      expect(response.body.data.user).toHaveProperty("id");
      expect(response.body.data.user.username).toBe(TEST_USER.username);
      expect(response.body.data.user.email).toBe(TEST_USER.email);
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");

      // Store user data and tokens for subsequent tests
      testContext.userId = response.body.data.user.id;
      testContext.accessToken = response.body.data.accessToken;
      testContext.refreshToken = response.body.data.refreshToken;
    });

    test("User can log in with their credentials", async () => {
      const response = await request(app).post("/api/auth/login").send({
        username: TEST_USER.username,
        password: TEST_USER.password,
      });

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.data.user).toHaveProperty("id");
      expect(response.body.data).toHaveProperty("accessToken");
      expect(response.body.data).toHaveProperty("refreshToken");

      // Update tokens for subsequent tests
      testContext.accessToken = response.body.data.accessToken;
      testContext.refreshToken = response.body.data.refreshToken;
    });
  });

  describe("2. Event Exploration", () => {
    test("User can see upcoming events", async () => {
      const response = await request(app)
        .get("/api/events/upcoming")
        .set("Authorization", `Bearer ${testContext.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("events");
      expect(Array.isArray(response.body.events)).toBe(true);

      // Store an event ID for later registration if events exist
      if (response.body.events.length > 0) {
        testContext.eventId = response.body.events[0].id;
      }
    });

    test("User can check event availability", async () => {
      // If no event was found in the previous test, find an available one
      if (!testContext.eventId) {
        const eventsResponse = await request(app).get("/api/events");
        expect(eventsResponse.status).toBe(200);

        if (eventsResponse.body.events.length > 0) {
          testContext.eventId = eventsResponse.body.events[0].id;
        } else {
          // Create a new event if none exists
          const newEvent = {
            status: "published",
            title: "E2E Test Event",
            description: "An event for e2e testing",
            location: "Virtual",
            start_time: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(), // 1 week from now
            end_time: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000
            ).toISOString(), // 2 hours later
            max_attendees: 10,
            price: 0,
            is_public: true,
          };

          const createEventResponse = await request(app)
            .post("/api/events")
            .set("Authorization", `Bearer ${testContext.accessToken}`)
            .send(newEvent);

          expect(createEventResponse.status).toBe(201);
          testContext.eventId = createEventResponse.body.event.id;
        }
      }

      // Check event availability
      const response = await request(app)
        .get(`/api/events/${testContext.eventId}/availability`)
        .set("Authorization", `Bearer ${testContext.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("available");
    });
  });

  describe("3. Event Registration and Tickets", () => {
    test("User can register for an event", async () => {
      // Ensure we have an event ID
      expect(testContext.eventId).not.toBeNull();
      expect(testContext.userId).not.toBeNull();

      const response = await request(app)
        .post(`/api/events/${testContext.eventId}/register`)
        .set("Authorization", `Bearer ${testContext.accessToken}`)
        .send({ userId: testContext.userId });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("msg");
      expect(response.body).toHaveProperty("registration");
      expect(response.body.registration.event_id).toBe(testContext.eventId);
      expect(response.body.registration.user_id).toBe(testContext.userId);

      // Store registration ID for later use
      testContext.registrationId = response.body.registration.id;
    });

    test("User can see their tickets", async () => {
      const response = await request(app)
        .get(`/api/tickets/user/${testContext.userId}`)
        .set("Authorization", `Bearer ${testContext.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("tickets");
      expect(Array.isArray(response.body.tickets)).toBe(true);
      expect(response.body.tickets.length).toBeGreaterThan(0);

      // Find the ticket for our registered event
      const ticket = response.body.tickets.find(
        (t: any) => t.event_id === testContext.eventId
      );
      expect(ticket).toBeDefined();

      // Store ticket code for later use
      testContext.ticketCode = ticket.ticket_code;
    });

    test("User can use their ticket", async () => {
      expect(testContext.ticketCode).not.toBeNull();

      const response = await request(app)
        .post(`/api/tickets/use/${testContext.ticketCode}`)
        .set("Authorization", `Bearer ${testContext.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.msg).toContain("marked as used");
      expect(response.body.ticket.status).toBe("used");
      expect(response.body.ticket.used_at).not.toBeNull();
    });

    test("User can cancel their registration", async () => {
      expect(testContext.registrationId).not.toBeNull();

      const response = await request(app)
        .patch(`/api/events/registrations/${testContext.registrationId}/cancel`)
        .set("Authorization", `Bearer ${testContext.accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("msg");
      expect(response.body.msg).toContain("cancelled successfully");
      expect(response.body.registration.status).toBe("cancelled");
    });
  });

  describe("4. User Account Management", () => {
    test("User can update their account details", async () => {
      const updatedDetails = {
        username: "updateduser",
        email: "updated@test.com",
      };

      const response = await request(app)
        .patch(`/api/users/${testContext.userId}`)
        .set("Authorization", `Bearer ${testContext.accessToken}`)
        .send(updatedDetails);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("success");
      expect(response.body.user.username).toBe(updatedDetails.username);
      expect(response.body.user.email).toBe(updatedDetails.email);

      // Update the testContext with new user details
      TEST_USER.username = updatedDetails.username;
      TEST_USER.email = updatedDetails.email;
    });

    test("User can delete their account", async () => {
      expect(testContext.userId).not.toBeNull();

      const response = await request(app)
        .delete(`/api/users/${testContext.userId}`)
        .set("Authorization", `Bearer ${testContext.accessToken}`);

      expect(response.status).toBe(204);

      // Verify account was deleted by trying to fetch it
      const getUserResponse = await request(app)
        .get(`/api/users/${testContext.userId}`)
        .set("Authorization", `Bearer ${testContext.accessToken}`);

      expect(getUserResponse.status).toBe(404);
    });
  });
});
