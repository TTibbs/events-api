import app from "../app";
import request from "supertest";
import db from "../db/connection";
import seed from "../db/seeds/seed";
import {
  events,
  eventRegistrations,
  users,
  teams,
  teamMembers,
  userSessions,
  tickets,
} from "../db/data/test-data/index";
import {
  EventResponse,
  EventRegistrationResponse,
  EventAvailabilityResponse,
} from "../types";
import {
  getAuthToken,
  getTokenForRole,
  authorizeRequest,
} from "../utils/testHelpers";

beforeEach(() =>
  seed({
    events,
    eventRegistrations,
    users,
    teams,
    teamMembers,
    userSessions,
    tickets,
  })
);

afterAll(async () => {
  await db.end();
});

describe("Event Registration API", () => {
  let testEvent: EventResponse;
  let testUser: { id: number; username: string; email: string };
  let pastEvent: EventResponse;
  let fullEvent: EventResponse;
  let draftEvent: EventResponse;

  beforeEach(async () => {
    // Get an auth token for creating events
    const adminToken = await getTokenForRole("admin");

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

    const eventResponse = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
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
        team_id: 1, // Add team_id to ensure the event is associated with a team
      });
    testEvent = eventResponse.body.event;

    // Create a past event
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    const pastEventResponse = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "published",
        title: "Past Test Event",
        description: "An event that's already happened",
        start_time: lastWeek.toISOString(),
        end_time: yesterday.toISOString(),
        is_public: true,
        team_id: 1, // Add team_id to ensure the event is associated with a team
      });
    pastEvent = pastEventResponse.body.event;

    // Create a full event (max_attendees = 1)
    const fullEventResponse = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "published",
        title: "Full Test Event",
        description: "An event with limited capacity",
        start_time: tomorrow.toISOString(),
        end_time: dayAfterTomorrow.toISOString(),
        max_attendees: 1,
        is_public: true,
        team_id: 1, // Add team_id to ensure the event is associated with a team
      });
    fullEvent = fullEventResponse.body.event;

    // Create a draft event
    const draftEventResponse = await request(app)
      .post("/api/events")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        status: "draft",
        title: "Draft Test Event",
        description: "An event that's not published yet",
        start_time: tomorrow.toISOString(),
        end_time: dayAfterTomorrow.toISOString(),
        is_public: true,
        team_id: 1, // Add team_id to ensure the event is associated with a team
      });
    draftEvent = draftEventResponse.body.event;

    // Register another user for the full event to reach capacity
    const otherUserResponse = await request(app).post("/api/users").send({
      username: "capacityuser",
      email: "capacity@example.com",
      plainPassword: "password123",
    });

    // Only try to register if user creation was successful
    if (
      otherUserResponse.statusCode === 201 &&
      otherUserResponse.body.newUser
    ) {
      const otherUser = otherUserResponse.body.newUser;

      // Login with the capacity user to get a token
      const loginResponse = await request(app).post("/api/auth/login").send({
        username: "capacityuser",
        password: "password123",
      });

      const capacityUserToken = loginResponse.body.data.accessToken;

      // Fill up the full event
      await request(app)
        .post(`/api/events/${fullEvent.id}/register`)
        .set("Authorization", `Bearer ${capacityUserToken}`)
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
      const token = await getAuthToken();
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
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
      const token = await getAuthToken();
      // First registration
      await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: testUser.id });

      // Try to register again
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: testUser.id });

      expect(response.status).toBe(400);
      expect(response.body.msg).toBe(
        "User is already registered for this event"
      );
    });
    test("Cannot register for events with unavailable status", async () => {
      const token = await getAuthToken();
      // Try to register for past event
      const pastResponse = await request(app)
        .post(`/api/events/${pastEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: testUser.id });

      expect(pastResponse.status).toBe(400);
      expect(pastResponse.body.msg).toBe("Event has already started");

      // Try to register for draft event
      const draftResponse = await request(app)
        .post(`/api/events/${draftEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: testUser.id });

      expect(draftResponse.status).toBe(400);
      expect(draftResponse.body.msg).toBe("Event is draft, not published");

      // Try to register for full event
      const fullResponse = await request(app)
        .post(`/api/events/${fullEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: testUser.id });

      expect(fullResponse.status).toBe(400);
      expect(fullResponse.body.msg).toBe(
        "Event has reached maximum attendee capacity"
      );
    });
    test("Cannot register with invalid user information", async () => {
      const token = await getAuthToken();
      // Missing user ID
      const missingUserResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({});

      expect(missingUserResponse.status).toBe(400);
      expect(missingUserResponse.body.msg).toBe("User ID is required");

      // Non-existent user ID
      const nonExistentUserResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 9999 });

      expect(nonExistentUserResponse.status).toBe(400); // The controller appears to be rejecting non-existent user IDs
    });
  });
  describe("Registration Management", () => {
    test("User can cancel registration", async () => {
      const token = await getAuthToken();
      // Register first - use alice123's ID (1) instead of testUser.id
      const registerResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 1 });

      const registrationId = registerResponse.body.registration.id;

      // Cancel registration
      const response = await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      const registration: EventRegistrationResponse =
        response.body.registration;

      expect(response.status).toBe(200);
      expect(response.body.msg).toBe("Registration cancelled successfully");
      expect(registration.status).toBe("cancelled");
    });
    test("User can reactivate a cancelled registration", async () => {
      const token = await getAuthToken();
      // Register first - use alice123's ID (1) instead of testUser.id
      const registerResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 1 });

      const registrationId = registerResponse.body.registration.id;

      // Cancel registration
      await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      // Try to register again (should reactivate)
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 1 });

      expect(response.status).toBe(200);
      expect(response.body.msg).toBe("Registration reactivated successfully");
      expect(response.body.registration.status).toBe("registered");
    });
    test("Cannot cancel an already cancelled registration", async () => {
      const token = await getAuthToken();
      // First register - use alice123's ID (1) instead of testUser.id
      const registerResponse = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: 1 });

      const registrationId = registerResponse.body.registration.id;

      // Cancel once
      await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .set("Authorization", `Bearer ${token}`);

      // Try to cancel again
      const secondCancelResponse = await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(secondCancelResponse.body.msg).toBe(
        "Registration is already cancelled"
      );
    });
    test("Should return 404 when cancelling a non-existent registration", async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .patch("/api/events/registrations/9999/cancel")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(response.body.msg).toBe("Registration not found");
    });
  });
  describe("Registration Listing", () => {
    test("Should get event registrations for an event", async () => {
      const token = await getAuthToken();
      // First register a user
      await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${token}`)
        .send({ userId: testUser.id });

      // Now get registrations
      const response = await request(app)
        .get(`/api/events/${testEvent.id}/registrations`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("registrations");
      expect(response.body.registrations).toBeInstanceOf(Array);
      expect(response.body.registrations.length).toBeGreaterThanOrEqual(1);

      const registration = response.body.registrations[0];
      expect(registration).toHaveProperty("id", expect.any(Number));
      expect(registration).toHaveProperty("event_id", testEvent.id);
      expect(registration).toHaveProperty("user_id", expect.any(Number));
      expect(registration).toHaveProperty("status", "registered");
    });
    test("Should return empty array when getting registrations for an event with no registrations", async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get(`/api/events/${draftEvent.id}/registrations`)
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
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
      // First create a test event
      const token = await getTokenForRole("admin");
      const newEvent = {
        title: "Test Event for Lookup",
        description: "This event is for testing lookup by ID",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 1,
        status: "published",
      };

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent)
        .expect(201);

      const eventId = createResponse.body.event.id;

      // Now look up the event
      const {
        body: { event },
      } = await request(app).get(`/api/events/${eventId}`).expect(200);

      expect(event).toHaveProperty("id", eventId);
      expect(event).toHaveProperty("title", newEvent.title);
      expect(event).toHaveProperty("status", newEvent.status);
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
      // First create a few upcoming events
      const token = await getTokenForRole("admin");
      const newEvent = {
        title: "Upcoming Test Event",
        description: "This event is for testing upcoming events",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 1,
        status: "published",
      };

      // Create an event to ensure there's at least one upcoming event
      await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent)
        .expect(201);

      // Now get upcoming events
      const {
        body: { events },
      } = await request(app).get("/api/events/upcoming").expect(200);

      expect(events).toBeInstanceOf(Array);
      // If there are upcoming events, check their properties
      if (events.length > 0) {
        events.forEach((event: EventResponse) => {
          expect(event).toHaveProperty("id", expect.any(Number));
          expect(event).toHaveProperty("title", expect.any(String));
          expect(event).toHaveProperty("start_time", expect.any(String));
          expect(event).toHaveProperty("end_time", expect.any(String));
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
      const token = await getTokenForRole("admin");
      const newEvent = {
        status: "published",
        title: "Test Event",
        description: "This is a test event",
        location: "Test Location",
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        team_id: 1, // Add team_id
        is_public: true,
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent);

      expect(response.status).toBe(201);
      const event: EventResponse = response.body.event;
      expect(event.title).toBe(newEvent.title);
      expect(event.status).toBe(newEvent.status);
      expect(event.description).toBe(newEvent.description);
      expect(event.is_public).toBe(true);
    });
    test("Should reject event creation when required fields are missing", async () => {
      const token = await getTokenForRole("admin");
      const missingFieldsEvent = {
        status: "published",
        // title is missing
        location: "Test Location",
        team_id: 1,
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(missingFieldsEvent);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Event title is required",
          }),
        ])
      );
    });
    test("Should reject event creation when end time is before start time", async () => {
      const token = await getTokenForRole("admin");
      const invalidTimesEvent = {
        status: "published",
        title: "Invalid Times Event",
        description: "Event with invalid times",
        location: "Test Location",
        team_id: 1,
        // End time is before start time
        start_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        end_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(invalidTimesEvent);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "End time must be after start time",
          }),
        ])
      );
    });
    test("Should handle default values and optional fields correctly", async () => {
      const token = await getTokenForRole("admin");
      const minimalEvent = {
        title: "Minimal Event",
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        team_id: 1, // Add team_id
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(minimalEvent);

      expect(response.status).toBe(201);
      expect(response.body.event.title).toBe("Minimal Event");
      expect(response.body.event.status).toBe("draft"); // Default status
      expect(response.body.event.is_public).toBe(true); // Default is_public
    });
    test("Should reject event creation when user is not an admin or event_manager", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Try to create an event for Team 1 (where charlie123 is not a member at all)
      const newEvent = {
        title: "Unauthorized Event",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
        team_id: 1, // Team 1 where charlie123 is not a member
      };

      // Use the authorizeRequest helper with team_member role (charlie123)
      const response = await authorizeRequest(
        request(app).post("/api/events").send(newEvent),
        "team_member"
      );

      expect(response.status).toBe(403);
      expect((response.body as any).status).toBe("error");
      expect((response.body as any).msg).toBe(
        "Forbidden - You don't have permission to create events for this team"
      );

      // Try to create an event for Team 2 (where charlie123 is admin, so this should work)
      const validEvent = {
        title: "Authorized Event",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
        team_id: 2, // Team 2 where charlie123 is admin
      };

      // Use the authorizeRequest helper with team_member role (charlie123 who is Team 2 admin)
      const validResponse = await authorizeRequest(
        request(app).post("/api/events").send(validEvent),
        "team_member"
      );

      expect(validResponse.status).toBe(201);
      expect((validResponse.body as any).event.title).toBe("Authorized Event");
    });
  });
  describe("PATCH /api/events/:id - Event Update", () => {
    test("Should successfully update an event with valid details", async () => {
      const token = await getTokenForRole("admin");
      // First create an event
      const newEvent = {
        status: "draft",
        title: "Event to Update",
        description: "This event will be updated",
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        team_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent);

      expect(createResponse.status).toBe(201);
      const eventId = createResponse.body.event.id;

      // Now update the event
      const updateData = {
        title: "Updated Event Title",
        description: "Updated description",
        status: "published",
      };

      const response = await request(app)
        .patch(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.updatedEvent.title).toBe(updateData.title);
      expect(response.body.updatedEvent.description).toBe(
        updateData.description
      );
      expect(response.body.updatedEvent.status).toBe(updateData.status);
    });
    test("Should return appropriate error when updating non-existent event", async () => {
      const token = await getTokenForRole("admin");
      const updateData = {
        title: "Updated Title",
        description: "Updated Description",
      };

      const response = await request(app)
        .patch("/api/events/9999")
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(404);
      expect(response.body.msg).toBe("Event not found");
    });
    test("Should reject update when end time is before start time", async () => {
      const token = await getTokenForRole("admin");

      // First create an event
      const newEvent = {
        status: "draft",
        title: "Event for Time Test",
        description: "This event will be tested for time validation",
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        team_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent);

      const eventId = createResponse.body.event.id;

      // Try to update with invalid times
      const invalidTimeUpdate = {
        start_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        end_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };

      const response = await request(app)
        .patch(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(invalidTimeUpdate);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe("End time must be after start time");
    });
    test("Should handle different field types and conversions during update", async () => {
      const token = await getTokenForRole("admin");
      // First create an event
      const newEvent = {
        status: "draft",
        title: "Event for Type Test",
        description: "Testing field type conversions",
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        max_attendees: "50", // String that should be converted to number
        team_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent)
        .expect(201);

      const eventId = createResponse.body.event.id;

      // Update with mixed types
      const updateData = {
        max_attendees: "100", // String that should be converted to number
        price: "15.99", // String that should be converted to decimal
        is_public: "true", // String that should be converted to boolean
      };

      const response = await request(app)
        .patch(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.updatedEvent.max_attendees).toBe(100);
      expect(response.body.updatedEvent.price).toBe(15.99);
      expect(response.body.updatedEvent.is_public).toBe(true);
    });
    test("Should reject update when user is not authorized for the team", async () => {
      // We need tokens for different roles
      const adminToken = await getTokenForRole("admin");
      const regularToken = await getTokenForRole("team_member");

      // First create an event as admin
      const newEvent = {
        title: "Admin-Only Event",
        description: "This event can only be updated by admins",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(newEvent)
        .expect(201);

      const eventId = createResponse.body.event.id;

      // Try to update as regular user
      const updateData = {
        title: "Unauthorized Update Attempt",
      };

      const response = await request(app)
        .patch(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${regularToken}`)
        .send(updateData)
        .expect(403);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe(
        "Forbidden - You don't have permission to update this event"
      );
    });
  });
  describe("DELETE /api/events/:id - Event Deletion", () => {
    test("Should successfully delete an event with valid ID", async () => {
      const token = await getTokenForRole("admin");

      // First create an event to delete
      const newEvent = {
        title: "Event to Delete",
        description: "This event will be deleted",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent);

      expect(createResponse.status).toBe(201);
      const eventId = createResponse.body.event.id;

      // Now delete the event as admin
      const deleteResponse = await request(app)
        .delete(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);

      // Verify event was deleted
      const checkResponse = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(404);
    });
    test("Should return appropriate error when deleting non-existent event", async () => {
      const token = await getTokenForRole("admin");

      const response = await request(app)
        .delete("/api/events/9999")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.msg).toBe("Event not found");
    });
    test("Should reject deletion when user is not authorized", async () => {
      // We need tokens for different roles
      const adminToken = await getTokenForRole("admin");
      const regularToken = await getTokenForRole("team_member");

      // Create event as admin
      const newEvent = {
        title: "Protected Event",
        description: "This event should be protected from deletion",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(newEvent)
        .expect(201);

      const eventId = createResponse.body.event.id;

      // Try to delete as regular user
      const response = await request(app)
        .delete(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(403);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe(
        "Forbidden - You don't have permission to delete this event"
      );
    });
  });
});
