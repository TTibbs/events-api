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
  stripePayments,
  categories,
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
import { sendRegistrationConfirmation } from "../utils/email";
import "jest-sorted";

// Mock the email utility
jest.mock("../utils/email", () => ({
  sendRegistrationConfirmation: jest.fn().mockResolvedValue({ success: true }),
}));

// Test utility functions
const createTestEvent = async (options: {
  token: string;
  status?: string;
  title: string;
  description?: string;
  isInPast?: boolean;
  maxAttendees?: number;
  teamId?: number;
  otherFields?: Record<string, any>;
}): Promise<EventResponse> => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayAfterTomorrow = new Date();
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  let startTime = tomorrow.toISOString();
  let endTime = dayAfterTomorrow.toISOString();

  if (options.isInPast) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);

    startTime = lastWeek.toISOString();
    endTime = yesterday.toISOString();
  }

  const eventData = {
    status: options.status || "published",
    title: options.title,
    description: options.description || `Description for ${options.title}`,
    location: "Test Location",
    start_time: startTime,
    end_time: endTime,
    max_attendees: options.maxAttendees,
    is_public: true,
    team_id: options.teamId || 1,
    category: "Conference", // Default category if not provided in otherFields
    ...options.otherFields,
  };

  const response = await request(app)
    .post("/api/events")
    .set("Authorization", `Bearer ${options.token}`)
    .send(eventData);

  return response.body.event;
};

// Helper for checking event existence in an array
const eventExistsInArray = (eventArray: any[], eventId: number): boolean => {
  return eventArray.some((event: any) => event.id === eventId);
};

// Helper for checking event properties
const checkEventProperties = (
  event: any,
  expectedProperties: Record<string, any>
): void => {
  Object.entries(expectedProperties).forEach(([key, value]) => {
    expect(event[key]).toEqual(value);
  });
};

beforeEach(() =>
  seed({
    events,
    eventRegistrations,
    users,
    teams,
    teamMembers,
    userSessions,
    tickets,
    stripePayments,
    categories,
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
  let adminToken: string;

  beforeEach(async () => {
    // Get an auth token for creating events
    adminToken = await getTokenForRole("team_admin");

    // Create a test user
    const userResponse = await request(app).post("/api/users").send({
      username: "registrationtester",
      email: "registrationtester@example.com",
      plainPassword: "password123",
    });
    testUser = userResponse.body.newUser;

    // Create test events using utility function
    testEvent = await createTestEvent({
      token: adminToken,
      title: "Test Registration Event",
      description: "An event for testing registrations",
      maxAttendees: 10,
      otherFields: {
        price: 0,
        category: "Workshop",
      },
    });

    pastEvent = await createTestEvent({
      token: adminToken,
      title: "Past Test Event",
      description: "An event that's already happened",
      isInPast: true,
    });

    fullEvent = await createTestEvent({
      token: adminToken,
      title: "Full Test Event",
      description: "An event with limited capacity",
      maxAttendees: 1,
      otherFields: {
        category: "Conference",
      },
    });

    draftEvent = await createTestEvent({
      token: adminToken,
      status: "draft",
      title: "Draft Test Event",
      description: "An event that's not published yet",
    });

    // Register another user for the full event to reach capacity
    const otherUserResponse = await request(app).post("/api/users").send({
      username: "capacityuser",
      email: "capacity@example.com",
      plainPassword: "password123",
    });

    // Only try to register if user creation was successful and fullEvent was created successfully
    if (
      otherUserResponse.statusCode === 201 &&
      otherUserResponse.body.newUser &&
      fullEvent &&
      fullEvent.id
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
    }
  });
  describe("Event Availability", () => {
    test("Check event availability returns available for a published future event", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(
        app
      ).get(`/api/events/${testEvent.id}/availability`);

      expect(body.available).toBe(true);
    });
    test("Event should be unavailable for various reasons (past, draft, full)", async () => {
      // Check past event
      const pastEventResponse = await request(app).get(
        `/api/events/${pastEvent.id}/availability`
      );

      expect(pastEventResponse.body.available).toBe(false);
      expect(pastEventResponse.body.reason).toBe("Event has already started");

      // Check draft event
      const draftEventResponse = await request(app).get(
        `/api/events/${draftEvent.id}/availability`
      );

      expect(draftEventResponse.body.available).toBe(false);
      expect(draftEventResponse.body.reason).toBe(
        "Event is draft, not published"
      );

      // Check if fullEvent is created properly
      if (!fullEvent || !fullEvent.id) {
        throw new Error(
          "Full event was not created successfully, test cannot continue"
        );
      }

      const fullEventResponse = await request(app).get(
        `/api/events/${fullEvent.id}/availability`
      );

      expect(fullEventResponse.body.available).toBe(false);
      expect(fullEventResponse.body.reason).toBe(
        "Event has reached maximum attendee capacity"
      );
    });

    test("Should properly handle error cases when checking availability", async () => {
      // Test non-existent event
      const nonExistentResponse = await request(app)
        .get("/api/events/9999/availability")
        .expect(404);

      expect(nonExistentResponse.body.status).toBe("error");
      expect(nonExistentResponse.body.msg).toBe("Event not found");

      // Test malformed event ID
      const malformedResponse = await request(app)
        .get(`/api/events/${testEvent.id}abc/availability`)
        .expect(400);

      expect(malformedResponse.body).toHaveProperty("msg");

      // Test non-numeric ID
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

      // Check if fullEvent is created and has proper registration
      if (!fullEvent || !fullEvent.id) {
        throw new Error(
          "Full event was not created successfully, test cannot continue"
        );
      }

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

      expect(nonExistentUserResponse.status).toBe(404); // The model now returns 404 for non-existent users
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
  describe("Event Registration with Email Confirmation", () => {
    test("Should send email confirmation when registering for an event", async () => {
      // Get token for authenticated user
      const userToken = await getAuthToken();

      // Reset mock before test
      (sendRegistrationConfirmation as jest.Mock).mockClear();

      // Create a new user for registration to avoid conflicts with existing registrations
      const userResponse = await request(app).post("/api/users").send({
        username: "emailtestuser",
        email: "emailtest@example.com",
        plainPassword: "password123",
      });
      const newUser = userResponse.body.newUser;

      // Register for the event with the new user
      const response = await request(app)
        .post(`/api/events/${testEvent.id}/register`)
        .set("Authorization", `Bearer ${userToken}`)
        .send({ userId: newUser.id });

      // Check registration was successful
      expect(response.statusCode).toBe(201);
      expect(response.body.msg).toBe("Registration successful");

      // Verify email confirmation was called
      expect(sendRegistrationConfirmation).toHaveBeenCalledTimes(1);

      // Verify email was sent with correct data
      const emailParams = (sendRegistrationConfirmation as jest.Mock).mock
        .calls[0][0];
      expect(emailParams).toHaveProperty("to");
      expect(emailParams).toHaveProperty("name");
      expect(emailParams).toHaveProperty("eventTitle");
      expect(emailParams).toHaveProperty("eventDate");
      expect(emailParams).toHaveProperty("ticketCode");
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
        expect(event).toHaveProperty("event_img_url", expect.any(String));
      });
    });
    test("Should return the total number of published events", async () => {
      const {
        body: { total_events },
      } = await request(app).get("/api/events").expect(200);
      expect(total_events).toBeGreaterThanOrEqual(1);
      expect(total_events).toEqual(expect.any(Number));
    });
  });
  describe("GET /api/events/:id - Event Lookup by ID", () => {
    test("Should retrieve an event with valid ID and handle errors for invalid IDs", async () => {
      // First create a test event
      const token = await getTokenForRole("team_admin");
      const newEvent = {
        title: "Test Event for Lookup",
        description: "This event is for testing lookup by ID",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 1,
        status: "published",
        category: "Conference",
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

      // Test error case with non-existent event ID
      const {
        body: { msg },
      } = await request(app).get("/api/events/9999").expect(404);

      expect(msg).toBe("Event not found");
    });
  });
  describe("GET /api/events/upcoming - Upcoming Events", () => {
    test("Should successfully retrieve upcoming events", async () => {
      // First create a few upcoming events
      const token = await getTokenForRole("team_admin");
      const newEvent = {
        title: "Upcoming Test Event",
        description: "This event is for testing upcoming events",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 1,
        status: "published",
        category: "Conference",
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
    test("Should successfully create events with various configurations", async () => {
      const token = await getTokenForRole("team_admin");
      const newEvent = {
        status: "published",
        title: "Test Event",
        description: "This is a test event",
        event_img_url:
          "https://c5znixeqj7.ufs.sh/f/Jf9D0EOZjwR5Q6eqKswUm9ctU0Xq42npAbSlV5j38hY6TkdR",
        location: "Test Location",
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        is_public: true,
        category: "Conference",
      };

      const {
        body: { event },
      } = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent)
        .expect(201);
      expect(event).toHaveProperty("id", expect.any(Number));
      expect(event).toHaveProperty("status", "published");
      expect(event).toHaveProperty("title", newEvent.title);
      expect(event).toHaveProperty("description", newEvent.description);
      expect(event).toHaveProperty("event_img_url", newEvent.event_img_url);
      expect(event).toHaveProperty("location", newEvent.location);
      expect(event).toHaveProperty("start_time", newEvent.start_time);
      expect(event).toHaveProperty("end_time", newEvent.end_time);
      expect(event).toHaveProperty("max_attendees", null);
      expect(event).toHaveProperty("price", null);
      expect(event).toHaveProperty("category", newEvent.category);
      expect(event).toHaveProperty("is_public", newEvent.is_public);
      expect(event).toHaveProperty("team_id", expect.any(Number));
      expect(event).toHaveProperty("created_by", expect.any(Number));
      expect(event).toHaveProperty("created_at", expect.any(String));
      expect(event).toHaveProperty("updated_at", expect.any(String));
    });
    test("Should use defaults when a minimal event is created", async () => {
      const token = await getTokenForRole("team_admin");
      const newEvent = {
        title: "Test Event",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        category: "Conference",
      };

      const {
        body: { event },
      } = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(newEvent)
        .expect(201);

      expect(event).toHaveProperty("status", "draft");
      expect(event).toHaveProperty("is_public", true);
      expect(event).toHaveProperty("team_id", expect.any(Number));
      expect(event).toHaveProperty("created_by", expect.any(Number));
      expect(event).toHaveProperty("created_at", expect.any(String));
      expect(event).toHaveProperty("updated_at", expect.any(String));
    });
    test("Should reject event creation with invalid inputs", async () => {
      const token = await getTokenForRole("team_admin");

      // Missing required fields
      const missingFieldsEvent = {
        status: "published",
        // title is missing
        location: "Test Location",
        team_id: 1,
        category: "Conference", // Add a valid category
      };

      const missingFieldsResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(missingFieldsEvent)
        .expect(400);

      expect(missingFieldsResponse.body.status).toBe("error");
      expect(missingFieldsResponse.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Event title is required",
          }),
        ])
      );

      // Invalid times (end before start)
      const invalidTimesEvent = {
        status: "published",
        title: "Invalid Times Event",
        description: "Event with invalid times",
        location: "Test Location",
        team_id: 1,
        start_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        end_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        category: "Conference", // Add a valid category
      };

      const invalidTimesResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${token}`)
        .send(invalidTimesEvent)
        .expect(400);

      expect(invalidTimesResponse.body.status).toBe("error");
      expect(invalidTimesResponse.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "End time must be after start time",
          }),
        ])
      );
    });
    test("Should enforce permission checks for event creation", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      // Try to create an event for Team 1 (where charlie123 is not a member)
      const unauthorizedEvent = {
        title: "Unauthorized Event",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
        team_id: 1, // Team 1 where charlie123 is not a member
        category: "Conference",
      };

      // Use authorizeRequest helper with team_member role (charlie123)
      const unauthorizedResponse = await authorizeRequest(
        request(app).post("/api/events").send(unauthorizedEvent),
        "team_member"
      );

      expect(unauthorizedResponse.status).toBe(403);
      expect((unauthorizedResponse.body as any).status).toBe("error");
      expect((unauthorizedResponse.body as any).msg).toBe(
        "Forbidden - You don't have permission to create events for this team"
      );

      // Create an event for Team 2 (where charlie123 is admin)
      const authorizedEvent = {
        title: "Authorized Event",
        start_time: tomorrow.toISOString(),
        end_time: nextWeek.toISOString(),
        team_id: 2, // Team 2 where charlie123 is admin
        category: "Conference",
      };

      const authorizedResponse = await authorizeRequest(
        request(app).post("/api/events").send(authorizedEvent),
        "team_member"
      );

      expect(authorizedResponse.status).toBe(201);
      expect((authorizedResponse.body as any).event.title).toBe(
        "Authorized Event"
      );
    });
  });
  describe("PATCH /api/events/:id - Event Update", () => {
    test("Should successfully update events with various changes", async () => {
      const token = await getTokenForRole("team_admin");

      // Create an event to update
      const createdEvent = await createTestEvent({
        token,
        status: "draft",
        title: "Event to Update",
        description: "This event will be updated",
      });

      // Test basic field updates
      const basicUpdateData = {
        title: "Updated Event Title",
        description: "Updated description",
        status: "published",
      };

      const basicUpdateResponse = await request(app)
        .patch(`/api/events/${createdEvent.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(basicUpdateData)
        .expect(200);

      checkEventProperties(
        basicUpdateResponse.body.updatedEvent,
        basicUpdateData
      );

      // Test type conversions during update
      const typeConversionEvent = await createTestEvent({
        token,
        title: "Event for Type Conversion",
        maxAttendees: 50,
      });

      const updateWithConversions = {
        max_attendees: "100", // String → number
        price: "15.99", // String → decimal
        is_public: "true", // String → boolean
      };

      const conversionResponse = await request(app)
        .patch(`/api/events/${typeConversionEvent.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(updateWithConversions)
        .expect(200);

      checkEventProperties(conversionResponse.body.updatedEvent, {
        max_attendees: 100,
        price: 15.99,
        is_public: true,
      });
    });
    test("Should accept event_img_url as a partial update", async () => {
      const token = await getTokenForRole("team_admin");
      const updateData = {
        event_img_url: "https://example.com/event-image.jpg",
      };
      const response = await request(app)
        .patch(`/api/events/1`)
        .set("Authorization", `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.updatedEvent.event_img_url).toBe(
        updateData.event_img_url
      );
    });
    test("Should reject updates with invalid data", async () => {
      const token = await getTokenForRole("team_admin");

      // Test updating non-existent event
      const nonExistentResponse = await request(app)
        .patch("/api/events/9999")
        .set("Authorization", `Bearer ${token}`)
        .send({ title: "Update Non-existent Event" })
        .expect(404);

      expect(nonExistentResponse.body.msg).toBe("Event not found");

      // Test invalid time update
      const eventForTimeTest = await createTestEvent({
        token,
        title: "Event for Time Validation",
      });

      const invalidTimeUpdate = {
        start_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        end_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };

      const timeUpdateResponse = await request(app)
        .patch(`/api/events/${eventForTimeTest.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(invalidTimeUpdate)
        .expect(400);

      expect(timeUpdateResponse.body.status).toBe("error");
      expect(timeUpdateResponse.body.msg).toBe(
        "End time must be after start time"
      );
    });
    test("Should enforce permissions for event updates", async () => {
      const adminToken = await getTokenForRole("team_admin");
      const regularToken = await getTokenForRole("team_member");

      // Create an event as admin
      const adminEvent = await createTestEvent({
        token: adminToken,
        title: "Admin-Only Event",
        description: "This event can only be updated by admins",
      });

      // Try to update as regular user
      const updateData = { title: "Unauthorized Update Attempt" };

      const response = await request(app)
        .patch(`/api/events/${adminEvent.id}`)
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
    test("Should handle event deletion with proper success cases and errors", async () => {
      const adminToken = await getTokenForRole("team_admin");
      const regularToken = await getTokenForRole("team_member");

      // Create events to test deletion
      const eventToDelete = await createTestEvent({
        token: adminToken,
        title: "Event to Delete",
        description: "This event will be deleted",
      });

      // Create a protected event
      const protectedEvent = await createTestEvent({
        token: adminToken,
        title: "Protected Event",
        description: "This event should be protected from deletion",
      });

      // Test successful deletion
      await request(app)
        .delete(`/api/events/${eventToDelete.id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(204);

      // Verify event was deleted
      await request(app).get(`/api/events/${eventToDelete.id}`).expect(404);

      // Test deleting non-existent event
      const nonExistentResponse = await request(app)
        .delete("/api/events/9999")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(404);

      expect(nonExistentResponse.body.msg).toBe("Event not found");

      // Test permission enforcement
      const unauthorizedResponse = await request(app)
        .delete(`/api/events/${protectedEvent.id}`)
        .set("Authorization", `Bearer ${regularToken}`)
        .expect(403);

      expect(unauthorizedResponse.body.status).toBe("error");
      expect(unauthorizedResponse.body.msg).toBe(
        "Forbidden - You don't have permission to delete this event"
      );

      // Verify protected event still exists
      const verifyResponse = await request(app)
        .get(`/api/events/${protectedEvent.id}`)
        .expect(200);

      expect(verifyResponse.body.event.id).toBe(protectedEvent.id);
    });
  });
});

describe("Event Visibility", () => {
  let team1DraftEvent: EventResponse;
  let team1PublishedEvent: EventResponse;
  let team2DraftEvent: EventResponse;
  let adminToken: string;
  let team1MemberToken: string;
  let team2MemberToken: string;
  let nonTeamMemberToken: string;

  beforeEach(async () => {
    // Get authentication tokens for different roles
    adminToken = await getTokenForRole("team_admin"); // Admin of team 1
    team1MemberToken = await getAuthToken(); // Alice - team 1 member
    team2MemberToken = await getTokenForRole("team_member"); // Charlie - team 2 member

    // Create a user who isn't a member of any team
    const nonTeamUser = await request(app).post("/api/users").send({
      username: "nonteammember",
      email: "nonteammember@example.com",
      plainPassword: "password123",
    });

    // Login with the non-team user to get a token
    const loginResponse = await request(app).post("/api/auth/login").send({
      username: "nonteammember",
      password: "password123",
    });
    nonTeamMemberToken = loginResponse.body.data.accessToken;

    // Create events using utility functions
    team1DraftEvent = await createTestEvent({
      token: adminToken,
      status: "draft",
      title: "Team 1 Draft Event",
      description: "This is a draft event for team 1",
      teamId: 1,
    });

    team1PublishedEvent = await createTestEvent({
      token: adminToken,
      title: "Team 1 Published Event",
      description: "This is a published event for team 1",
      teamId: 1,
    });

    team2DraftEvent = await createTestEvent({
      token: team2MemberToken,
      status: "draft",
      title: "Team 2 Draft Event",
      description: "This is a draft event for team 2",
      teamId: 2,
    });
  });
  test("Team 1 member should see team 1 draft events in GET /api/events", async () => {
    // For published events
    const publishedResponse = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${team1MemberToken}`);

    expect(publishedResponse.status).toBe(200);
    const publishedEvents = publishedResponse.body.events;

    // Should NOT include the team 1 draft event in published events
    expect(eventExistsInArray(publishedEvents, team1DraftEvent.id)).toBe(false);

    // Should include the team 1 published event
    expect(eventExistsInArray(publishedEvents, team1PublishedEvent.id)).toBe(
      true
    );

    // For draft events, get from the /draft endpoint
    const draftResponse = await request(app)
      .get("/api/events/draft")
      .set("Authorization", `Bearer ${team1MemberToken}`);

    expect(draftResponse.status).toBe(200);
    const draftEvents = draftResponse.body.events;

    // Should include the team 1 draft event in draft events
    expect(eventExistsInArray(draftEvents, team1DraftEvent.id)).toBe(true);

    // Should NOT include the team 2 draft event in draft events
    expect(eventExistsInArray(draftEvents, team2DraftEvent.id)).toBe(false);

    // Also verify Team 2 member sees their drafts
    const team2DraftResponse = await request(app)
      .get("/api/events/draft")
      .set("Authorization", `Bearer ${team2MemberToken}`);

    expect(team2DraftResponse.status).toBe(200);
    const team2DraftEvents = team2DraftResponse.body.events;

    // Should include the team 2 draft event in draft events for team 2 member
    expect(eventExistsInArray(team2DraftEvents, team2DraftEvent.id)).toBe(true);
  });

  test("Non-team member and unauthenticated users should only see published events in GET /api/events", async () => {
    // Test authenticated non-team member
    const response = await request(app)
      .get("/api/events")
      .set("Authorization", `Bearer ${nonTeamMemberToken}`);

    expect(response.status).toBe(200);
    const events = response.body.events;

    // Should NOT include the team 1 draft event
    expect(eventExistsInArray(events, team1DraftEvent.id)).toBe(false);

    // Should include the team 1 published event
    expect(eventExistsInArray(events, team1PublishedEvent.id)).toBe(true);

    // Should NOT include the team 2 draft event
    expect(eventExistsInArray(events, team2DraftEvent.id)).toBe(false);

    // Test unauthenticated user
    const unauthResponse = await request(app).get("/api/events");
    expect(unauthResponse.status).toBe(200);
    const unauthEvents = unauthResponse.body.events;

    // Should only see published events
    expect(eventExistsInArray(unauthEvents, team1DraftEvent.id)).toBe(false);

    // Should see published events
    expect(eventExistsInArray(unauthEvents, team1PublishedEvent.id)).toBe(true);
  });
  test("Team member should see their team's draft event by ID", async () => {
    // Try to get draft event using the regular endpoint (should fail)
    const regularResponse = await request(app)
      .get(`/api/events/${team1DraftEvent.id}`)
      .set("Authorization", `Bearer ${team1MemberToken}`);

    expect(regularResponse.status).toBe(404);

    // Should be able to get draft event using the draft endpoint
    const draftResponse = await request(app)
      .get(`/api/events/${team1DraftEvent.id}/draft`)
      .set("Authorization", `Bearer ${team1MemberToken}`);

    expect(draftResponse.status).toBe(200);
    expect(draftResponse.body.event.id).toBe(team1DraftEvent.id);
  });
  test("Non-team member should not see draft event by ID", async () => {
    // Regular endpoint should return 404
    const regularResponse = await request(app)
      .get(`/api/events/${team1DraftEvent.id}`)
      .set("Authorization", `Bearer ${nonTeamMemberToken}`);

    expect(regularResponse.status).toBe(404);
    expect(regularResponse.body.msg).toBe("Event not found");

    // Draft endpoint should also return 404
    const draftResponse = await request(app)
      .get(`/api/events/${team1DraftEvent.id}/draft`)
      .set("Authorization", `Bearer ${nonTeamMemberToken}`);

    expect(draftResponse.status).toBe(404);
    expect(draftResponse.body.msg).toBe(
      "Draft event not found or you don't have access to it"
    );
  });
  test("Team member should see only their team's draft events in team listing", async () => {
    // Get Team 1 published events as Team 1 member
    const team1PublishedResponse = await request(app)
      .get("/api/events/team/1")
      .set("Authorization", `Bearer ${team1MemberToken}`);

    expect(team1PublishedResponse.status).toBe(200);
    const team1PublishedEvents = team1PublishedResponse.body.events;

    // Should NOT include the team 1 draft event in published events
    expect(eventExistsInArray(team1PublishedEvents, team1DraftEvent.id)).toBe(
      false
    );

    // Get Team 1 draft events as Team 1 member
    const team1DraftResponse = await request(app)
      .get("/api/events/team/1/draft")
      .set("Authorization", `Bearer ${team1MemberToken}`);

    expect(team1DraftResponse.status).toBe(200);
    const team1DraftEvents = team1DraftResponse.body.events;

    // Should include the team 1 draft event in draft events
    expect(eventExistsInArray(team1DraftEvents, team1DraftEvent.id)).toBe(true);

    // Get Team 2 draft events as Team 1 member (should be empty)
    const team2DraftResponse = await request(app)
      .get("/api/events/team/2/draft")
      .set("Authorization", `Bearer ${team1MemberToken}`);

    expect(team2DraftResponse.status).toBe(200);
    const team2DraftEvents = team2DraftResponse.body.events;

    // Should NOT include the team 2 draft event in team 2 draft events for team 1 member
    expect(eventExistsInArray(team2DraftEvents, team2DraftEvent.id)).toBe(
      false
    );
  });
});

// Add tests for the event filtering functionality
describe("GET /api/events - Filter Events", () => {
  beforeEach(async () => {
    // Get admin token for creating test events
    const adminToken = await getTokenForRole("team_admin");

    // Create events with different categories, locations, prices
    await createTestEvent({
      token: adminToken,
      title: "Conference Event",
      description: "A conference event",
      otherFields: {
        category: "Conference",
        location: "London",
        price: 100,
      },
    });

    await createTestEvent({
      token: adminToken,
      title: "Workshop Event",
      description: "A workshop event",
      otherFields: {
        category: "Workshop",
        location: "New York",
        price: 50,
      },
    });

    await createTestEvent({
      token: adminToken,
      title: "Meetup Event",
      description: "A meetup event",
      otherFields: {
        category: "Meetup",
        location: "Berlin",
        price: 0,
      },
    });

    await createTestEvent({
      token: adminToken,
      title: "Tech Workshop",
      description: "A tech workshop event",
      otherFields: {
        category: "Workshop",
        location: "New York",
        price: 75,
      },
    });
  });

  test("should filter events by category", async () => {
    const response = await request(app)
      .get("/api/events?category=Workshop")
      .expect(200);
    expect(response.body.events.length).toBeGreaterThan(0);
    response.body.events.forEach((event: any) => {
      expect(event.category).toBe("Workshop");
    });
  });

  test("should filter events by location", async () => {
    const response = await request(app)
      .get("/api/events?location=New York")
      .expect(200);

    expect(response.body.events.length).toBeGreaterThan(0);
    response.body.events.forEach((event: any) => {
      expect(event.location).toContain("New York");
    });
  });

  test("should filter events by minimum price", async () => {
    const response = await request(app)
      .get("/api/events?min_price=50")
      .expect(200);

    expect(response.body.events.length).toBeGreaterThan(0);
    response.body.events.forEach((event: any) => {
      expect(parseFloat(event.price)).toBeGreaterThanOrEqual(50);
    });
  });

  test("should filter events by maximum price", async () => {
    const response = await request(app)
      .get("/api/events?max_price=75")
      .expect(200);

    expect(response.body.events.length).toBeGreaterThan(0);
    response.body.events.forEach((event: any) => {
      expect(parseFloat(event.price)).toBeLessThanOrEqual(75);
    });
  });

  test("should filter events by price range", async () => {
    const response = await request(app)
      .get("/api/events?min_price=50&max_price=100")
      .expect(200);

    expect(response.body.events.length).toBeGreaterThan(0);
    response.body.events.forEach((event: any) => {
      const price = parseFloat(event.price);
      expect(price).toBeGreaterThanOrEqual(50);
      expect(price).toBeLessThanOrEqual(100);
    });
  });

  test("should filter events by start date", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0]; // Get YYYY-MM-DD

    const response = await request(app)
      .get(`/api/events?start_date=${tomorrowStr}`)
      .expect(200);

    expect(response.body.events.length).toBeGreaterThan(0);
    response.body.events.forEach((event: any) => {
      const eventDate = new Date(event.start_time);
      // Check only the date part, ignore time differences
      expect(
        new Date(eventDate.toISOString().split("T")[0]).getTime()
      ).toBeGreaterThanOrEqual(new Date(tomorrowStr).getTime());
    });
  });

  test("should handle non-existent category", async () => {
    const response = await request(app)
      .get("/api/events?category=NonExistentCategory")
      .expect(404);

    expect(response.body.status).toBe("error");
    expect(response.body.msg).toContain("NonExistentCategory");
  });

  test("should combine multiple filters correctly", async () => {
    const response = await request(app)
      .get(
        "/api/events?category=Workshop&location=New York&min_price=50&max_price=75"
      )
      .expect(200);
    expect(response.body.events.length).toBeGreaterThan(0);
    response.body.events.forEach((event: any) => {
      expect(event.category).toBe("Workshop");
      expect(event.location).toContain("New York");
      const price = parseFloat(event.price);
      expect(price).toBeGreaterThanOrEqual(50);
      expect(price).toBeLessThanOrEqual(75);
    });
  });

  test("should return correct total_events count when filtering", async () => {
    const response = await request(app)
      .get("/api/events?category=Workshop")
      .expect(200);

    // Count should match the number of workshop events
    expect(response.body.total_events).toBe(response.body.events.length);
  });
});

describe("Event Sorting", () => {
  test("GET /api/events - should sort events by start_time in ascending order by default", async () => {
    const { body } = await request(app).get("/api/events").expect(200);
    expect(body.events.length).toBeGreaterThan(0); // At least one event exists
    expect(body.events).toBeSorted({ key: "start_time" });
  });
  test("GET /api/events - should sort events by start_time in descending order when specified", async () => {
    const { body } = await request(app)
      .get("/api/events?order=desc")
      .expect(200);
    expect(body.events).toBeSorted({ key: "start_time", descending: true });
  });
  test("GET /api/events - should sort events by price in ascending order when specified", async () => {
    const { body } = await request(app)
      .get("/api/events?sort_by=price")
      .expect(200);
    expect(body.events).toBeSorted({ key: "price" });
  });
  test("GET /api/events - should sort events by price in descending order when specified", async () => {
    const { body } = await request(app)
      .get("/api/events?sort_by=price&order=desc")
      .expect(200);
    expect(body.events).toBeSorted({ key: "price", descending: true });
  });
  test("GET /api/events - should sort events by location in ascending order when specified", async () => {
    const { body } = await request(app)
      .get("/api/events?sort_by=location")
      .expect(200);
    expect(body.events).toBeSorted({ key: "location" });
  });
  test("GET /api/events - should sort events by location in descending order when specified", async () => {
    const { body } = await request(app)
      .get("/api/events?sort_by=location&order=desc")
      .expect(200);
    expect(body.events).toBeSorted({ key: "location", descending: true });
  });
  test("GET /api/events - should sort events by category in ascending order when specified", async () => {
    const { body } = await request(app)
      .get("/api/events?sort_by=category")
      .expect(200);
    expect(body.events).toBeSorted({ key: "category" });
  });
  test("GET /api/events - should sort events by category in descending order when specified", async () => {
    const { body } = await request(app)
      .get("/api/events?sort_by=category&order=desc")
      .expect(200);
    expect(body.events).toBeSorted({ key: "category", descending: true });
  });
  test("GET /api/events - should return 400 error for invalid sort_by parameter", async () => {
    const { body } = await request(app)
      .get("/api/events?sort_by=invalid_field")
      .expect(400);
    expect(body.msg).toBe("Invalid sort_by query");
  });
  test("GET /api/events - should return 400 error for invalid order parameter", async () => {
    const { body } = await request(app)
      .get("/api/events?order=invalid_order")
      .expect(400);
    expect(body.msg).toBe("Invalid order query");
  });
});
