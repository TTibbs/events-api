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
  EventRegistrationError,
} from "../types";
import { getAuthToken } from "../utils/testHelpers";
import { sendRegistrationConfirmation } from "../utils/email";
import "jest-sorted";

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

// Mock the email utility
jest.mock("../utils/email", () => ({
  sendRegistrationConfirmation: jest.fn().mockResolvedValue({ success: true }),
}));

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
  describe("Event Availability - /api/events/:id/availability", () => {
    test("Check event availability returns available for a published future event", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(
        app
      ).get(`/api/events/1/availability`);
      expect(body.available).toBe(true);
    });
    test("Should return an error for an event that has already started", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(app)
        .get(`/api/events/13/availability`)
        .expect(200);
      expect(body.available).toBe(false);
      expect(body.reason).toBe("Event has already started");
    });
    test("Should return a message if the event has already finished", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(
        app
      ).get(`/api/events/14/availability`);

      expect(body.available).toBe(false);
      expect(body.reason).toBe("Event has already finished");
    });
    test("Should return a message if the event is a draft event", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(app)
        .get(`/api/events/2/availability`)
        .expect(200);
      expect(body.available).toBe(false);
      expect(body.reason).toBe("Event is draft, not published");
    });
    test("Should try to register for a full event and provide a message", async () => {
      const registerResponse = await request(app)
        .post(`/api/events/15/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 })
        .expect(400);
      expect(registerResponse.body.msg).toBe(
        "Event has reached maximum attendee capacity"
      );

      const { body }: { body: EventAvailabilityResponse } = await request(app)
        .get(`/api/events/15/availability`)
        .expect(200);
      expect(body.available).toBe(false);
      expect(body.reason).toBe("Event has reached maximum attendee capacity");
    });
    test("Should return an error message if the event is not found", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(app)
        .get("/api/events/9999/availability")
        .expect(404);
      expect(body).toHaveProperty("status", "error");
      expect(body).toHaveProperty("msg", "Event not found");
    });
    test("Should return an error message if the event id is not a number", async () => {
      const { body }: { body: EventAvailabilityResponse } = await request(app)
        .get("/api/events/NaN/availability")
        .expect(400);
      expect(body).toHaveProperty("status", "error");
      expect(body).toHaveProperty("msg", "Invalid event ID format");
    });
  });
  describe("Event Registration - /api/events/:id/register", () => {
    test("User can register for an available event", async () => {
      const { body }: { body: EventRegistrationResponse } = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 })
        .expect(201);

      expect(body).toHaveProperty("msg", "Registration successful");
      expect(body).toHaveProperty("registration");
      expect(body.registration).toHaveProperty("event_id", 1);
      expect(body.registration).toHaveProperty("user_id", 5);
      expect(body.registration).toHaveProperty(
        "registration_time",
        expect.any(String)
      );
      expect(body.registration).toHaveProperty("status", "registered");
      expect(body.registration).toHaveProperty("ticket_info");
      expect(body.registration?.ticket_info).toHaveProperty(
        "ticket_code",
        expect.any(String)
      );
      expect(body.registration?.ticket_info).toHaveProperty(
        "event_title",
        "Tech Conference 2025"
      );
      expect(body.registration?.ticket_info).toHaveProperty(
        "event_date",
        expect.any(String)
      );
      expect(body.registration?.ticket_info).toHaveProperty(
        "event_location",
        "New York"
      );
      expect(body.registration?.ticket_info).toHaveProperty(
        "user_name",
        "regularuser"
      );
      expect(body.registration?.ticket_info).toHaveProperty(
        "user_email",
        "regularuser@example.com"
      );
    });
    test("User cannot register twice for the same event", async () => {
      await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 });

      const response = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 });
      expect(response.status).toBe(400);
      expect(response.body.msg).toBe(
        "User is already registered for this event"
      );
    });
    test("Cannot register with missing user information", async () => {
      const { body }: { body: EventRegistrationError } = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({})
        .expect(400);
      expect(body.msg).toBe("User ID is required");
    });
    test("Cannot register with a non-existent user id", async () => {
      const { body }: { body: EventRegistrationError } = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 9999 })
        .expect(404);

      expect(body.msg).toBe("User not found");
    });
  });
  describe("Registration Management - POST/PATCH /api/events/registrations/:id", () => {
    test("User can cancel registration", async () => {
      const registerResponse = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 });

      const registrationId = registerResponse.body.registration.id;
      const response = await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(200);

      const registration: EventRegistrationResponse =
        response.body.registration;

      expect(response.body.msg).toBe("Registration cancelled successfully");
      expect(registration.status).toBe("cancelled");
    });
    test("User can reactivate a cancelled registration", async () => {
      const registerResponse = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 });

      const registrationId = registerResponse.body.registration.id;

      // Cancel registration
      const cancellationResponse = await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(200);

      expect(cancellationResponse.body.registration.status).toBe("cancelled");

      // Try to register again (should reactivate)
      const response = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 });

      expect(response.body.msg).toBe("Registration reactivated successfully");
      expect(response.body.registration.status).toBe("registered");
    });
    test("Cannot cancel an already cancelled registration", async () => {
      // First register - use aliceToken's ID (1) instead of testUser.id
      const registerResponse = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .send({ userId: 1 });

      const registrationId = registerResponse.body.registration.id;

      // Cancel once
      await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .set("Authorization", `Bearer ${aliceToken}`);

      // Try to cancel again
      const secondCancelResponse = await request(app)
        .patch(`/api/events/registrations/${registrationId}/cancel`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(400);

      expect(secondCancelResponse.body.msg).toBe(
        "Registration is already cancelled"
      );
    });
    test("Should return 404 when cancelling a non-existent registration", async () => {
      const response = await request(app)
        .patch("/api/events/registrations/9999/cancel")
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(404);

      expect(response.body.msg).toBe("Registration not found");
    });
  });
  describe("Registration Listing - /api/events/:id/registrations", () => {
    test("Should get event registrations for an event", async () => {
      // First register a user
      await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 });

      // Now get registrations
      const response = await request(app)
        .get(`/api/events/1/registrations`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("registrations");
      expect(response.body.registrations).toBeInstanceOf(Array);
      expect(response.body.registrations.length).toBeGreaterThanOrEqual(1);

      const registration = response.body.registrations[0];
      expect(registration).toHaveProperty("id", expect.any(Number));
      expect(registration).toHaveProperty("event_id", 1);
      expect(registration).toHaveProperty("user_id", 5);
      expect(registration).toHaveProperty("status", "registered");
    });
    test("Should return empty array when getting registrations for an event with no registrations", async () => {
      const response = await request(app)
        .get(`/api/events/16/registrations`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(200);

      expect(response.body.registrations).toBeInstanceOf(Array);
      expect(response.body.registrations.length).toBe(0);
    });
  });
  describe("Event Registration with Email Confirmation - POST /api/events/:id/register", () => {
    test("Should send email confirmation when registering for an event", async () => {
      // Reset mock before test
      (sendRegistrationConfirmation as jest.Mock).mockClear();

      // Register for the event with the new user
      const response = await request(app)
        .post(`/api/events/1/register`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send({ userId: 5 });

      // Check registration was successful
      expect(response.statusCode).toBe(201);
      expect(response.body.msg).toBe("Registration successful");

      // Verify email confirmation was called
      expect(sendRegistrationConfirmation).toHaveBeenCalledTimes(1);

      const emailParams = (sendRegistrationConfirmation as jest.Mock).mock
        .calls[0][0];
      expect(emailParams).toHaveProperty("to");
      expect(emailParams).toHaveProperty("name");
      expect(emailParams).toHaveProperty("eventTitle");
      expect(emailParams).toHaveProperty("eventDate");
      expect(emailParams).toHaveProperty("eventLocation");
      expect(emailParams).toHaveProperty("ticketCode");
    });
  });
});

describe("Events API Endpoints", () => {
  describe("GET /api/events/categories", () => {
    test("Should return all event categories", async () => {
      const { body } = await request(app)
        .get("/api/events/categories")
        .expect(200);
      expect(body.categories).toBeInstanceOf(Array);
      expect(body.categories.length).toBeGreaterThanOrEqual(1);
    });
  });
  describe("GET /api/events/categories/:name", () => {
    test("Should return an event category by name", async () => {
      const { body } = await request(app)
        .get("/api/events/categories/Conference")
        .expect(200);
      expect(body.category).toHaveProperty("id", expect.any(Number));
      expect(body.category).toHaveProperty("name", "Conference");
    });
    test("Should return 404 if category is not found", async () => {
      const { body } = await request(app)
        .get("/api/events/categories/NonExistentCategory")
        .expect(404);
      expect(body.msg).toBe("Category 'NonExistentCategory' not found");
    });
  });
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
    test("Should only return published events for any users regardless of role", async () => {
      const regularUserResponse = await request(app)
        .get("/api/events")
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(200);
      expect(regularUserResponse.body.events.length).toBeGreaterThanOrEqual(1);
      regularUserResponse.body.events.forEach((event: EventResponse) => {
        expect(event.status).not.toBe("draft");
      });
      const aliceResponse = await request(app)
        .get("/api/events")
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(200);
      expect(aliceResponse.body.events.length).toBeGreaterThanOrEqual(1);
      aliceResponse.body.events.forEach((event: EventResponse) => {
        expect(event.status).not.toBe("draft");
      });
      const bobResponse = await request(app)
        .get("/api/events")
        .set("Authorization", `Bearer ${bobToken}`)
        .expect(200);
      expect(bobResponse.body.events.length).toBeGreaterThanOrEqual(1);
      bobResponse.body.events.forEach((event: EventResponse) => {
        expect(event.status).not.toBe("draft");
      });
      const siteAdminResponse = await request(app)
        .get("/api/events")
        .set("Authorization", `Bearer ${siteadminToken}`)
        .expect(200);
      expect(siteAdminResponse.body.events.length).toBeGreaterThanOrEqual(1);
      siteAdminResponse.body.events.forEach((event: EventResponse) => {
        expect(event.status).not.toBe("draft");
      });
    });
    test("Should not return past events in the event listings", async () => {
      const { body } = await request(app).get("/api/events").expect(200);

      // Check that no past events are returned
      body.events.forEach((event: EventResponse) => {
        expect(event.is_past).toBe(false);
      });

      // Also verify that events with end_time in the past are marked as past
      const pastEvent = await request(app)
        .get("/api/events/3") // ID of our known past event
        .expect(404); // Should return 404 as past events are filtered out

      expect(pastEvent.body.msg).toBe("Event not found");
    });

    describe("Past Events Filtering", () => {
      test("Should not return any events where end_time is in the past", async () => {
        const { body } = await request(app).get("/api/events").expect(200);

        const now = new Date();
        console.log("Current time:", now.toISOString());

        body.events.forEach((event: EventResponse) => {
          const eventEndTime = new Date(event.end_time);
          console.log("Event:", {
            title: event.title,
            end_time: eventEndTime.toISOString(),
            is_past: event.is_past,
          });
          expect(eventEndTime.getTime()).toBeGreaterThan(now.getTime());
        });
      });

      test("Should not return any events marked as is_past=true", async () => {
        const { body } = await request(app).get("/api/events").expect(200);

        body.events.forEach((event: EventResponse) => {
          console.log("Event is_past check:", {
            title: event.title,
            is_past: event.is_past,
          });
          expect(event.is_past).toBe(false);
        });
      });

      test("Should not return events that started in the past but haven't ended yet", async () => {
        const { body } = await request(app).get("/api/events").expect(200);

        const now = new Date();
        console.log("Current time:", now.toISOString());

        body.events.forEach((event: EventResponse) => {
          const eventStartTime = new Date(event.start_time);
          console.log("Event start time check:", {
            title: event.title,
            start_time: eventStartTime.toISOString(),
            is_past: event.is_past,
          });
          expect(eventStartTime.getTime()).toBeGreaterThan(now.getTime());
        });
      });

      test("Should correctly handle events at the current time boundary", async () => {
        const now = new Date();
        console.log("Setting up boundary test at:", now.toISOString());

        // First, let's create an event that's just about to end
        const almostEndingEvent = {
          status: "published",
          title: "Almost Ending Event",
          description: "This event is about to end",
          location: "Test Location",
          start_time: new Date(Date.now() - 3600000), // 1 hour ago
          end_time: new Date(Date.now() + 60000), // 1 minute in future
          category: "Conference",
          is_public: true,
        };

        console.log("Creating test event:", {
          start: almostEndingEvent.start_time.toISOString(),
          end: almostEndingEvent.end_time.toISOString(),
        });

        await request(app)
          .post("/api/events")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send(almostEndingEvent);

        // Now check the events listing
        const { body } = await request(app).get("/api/events").expect(200);

        // Verify that events very close to ending are handled correctly
        const checkTime = new Date();
        console.log("Checking events at:", checkTime.toISOString());

        body.events.forEach((event: EventResponse) => {
          const eventEndTime = new Date(event.end_time);

          // For debugging if test fails
          if (eventEndTime.getTime() <= checkTime.getTime()) {
            console.log("Found past event:", {
              title: event.title,
              end_time: eventEndTime.toISOString(),
              check_time: checkTime.toISOString(),
              is_past: event.is_past,
            });
          }

          expect(eventEndTime.getTime()).toBeGreaterThan(checkTime.getTime());
          expect(event.is_past).toBe(false);
        });
      });

      test("Should handle timezone differences correctly", async () => {
        const now = new Date();
        console.log("Setting up timezone test at:", now.toISOString());

        // Create an event with explicit UTC times
        const utcEvent = {
          status: "published",
          title: "UTC Test Event",
          description: "Testing UTC handling",
          location: "Test Location",
          start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow UTC
          end_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow UTC
          category: "Conference",
          is_public: true,
        };

        console.log("Creating UTC test event:", {
          start: utcEvent.start_time,
          end: utcEvent.end_time,
        });

        await request(app)
          .post("/api/events")
          .set("Authorization", `Bearer ${aliceToken}`)
          .send(utcEvent);

        const { body } = await request(app).get("/api/events").expect(200);

        // Verify UTC handling
        const checkTimeUTC = new Date();
        console.log("Checking UTC events at:", checkTimeUTC.toISOString());

        body.events.forEach((event: EventResponse) => {
          const eventEndTimeUTC = new Date(event.end_time);
          console.log("UTC Event check:", {
            title: event.title,
            end_time: eventEndTimeUTC.toISOString(),
            is_past: event.is_past,
          });

          expect(eventEndTimeUTC.getTime()).toBeGreaterThan(
            checkTimeUTC.getTime()
          );
          expect(event.is_past).toBe(false);
        });
      });
    });
  });
  describe("GET /api/events - Query Parameters", () => {
    test("Should return total_events count in the response", async () => {
      const response = await request(app)
        .get("/api/events?sort_by=start_time")
        .expect(200);
      expect(response.body).toHaveProperty("total_events", expect.any(Number));
    });
    test("Should sort events by start_time in ascending order by default", async () => {
      const { body } = await request(app).get("/api/events").expect(200);
      expect(body.events).toBeSorted({ key: "start_time", descending: false });
    });
    test("Should sort events by start_time in descending order when specified", async () => {
      const { body } = await request(app)
        .get("/api/events?order=desc")
        .expect(200);
      expect(body.events).toBeSorted({ key: "start_time", descending: true });
    });
    test("Should sort events by price with default ascending order", async () => {
      const { body } = await request(app)
        .get("/api/events?sort_by=price")
        .expect(200);
      expect(body.events).toBeSorted({ key: "price", descending: false });
    });
    test("Should sort events by price in descending order when specified", async () => {
      const { body } = await request(app)
        .get("/api/events?sort_by=price&order=desc")
        .expect(200);
      expect(body.events).toBeSorted({ key: "price", descending: true });
    });
    test("Should sort events by location with default ascending order", async () => {
      const { body } = await request(app)
        .get("/api/events?sort_by=location")
        .expect(200);
      expect(body.events).toBeSorted({ key: "location", descending: false });
    });
    test("Should sort events by location in descending order when specified", async () => {
      const { body } = await request(app)
        .get("/api/events?sort_by=location&order=desc")
        .expect(200);
      expect(body.events).toBeSorted({ key: "location", descending: true });
    });
    test("Should sort events by max_attendees with default ascending order", async () => {
      const { body } = await request(app)
        .get("/api/events?sort_by=max_attendees")
        .expect(200);
      expect(body.events).toBeSorted({
        key: "max_attendees",
        descending: false,
      });
    });
    test("Should sort events by max_attendees in descending order when specified", async () => {
      const { body } = await request(app)
        .get("/api/events?sort_by=max_attendees&order=desc")
        .expect(200);
      expect(body.events).toBeSorted({
        key: "max_attendees",
        descending: true,
      });
    });
    test("Should take conference as a category as a query parameter", async () => {
      const { body } = await request(app)
        .get("/api/events?category=Conference")
        .expect(200);
      expect(body.events).toBeInstanceOf(Array);
      body.events.forEach((event: EventResponse) => {
        expect(event.category).toBe("Conference");
      });
    });
    test("Should take conference as a category as a query parameter in descending order", async () => {
      const { body } = await request(app)
        .get("/api/events?category=Conference&order=desc")
        .expect(200);
      expect(body.events).toBeSorted({ key: "category", descending: true });
    });
    test("Should take other categories as a query parameter", async () => {
      const { body } = await request(app)
        .get("/api/events?category=Workshop")
        .expect(200);
      expect(body.events).toBeInstanceOf(Array);
      body.events.forEach((event: EventResponse) => {
        expect(event.category).toBe("Workshop");
      });
    });
    test("Should limit results when limit parameter is provided", async () => {
      const {
        body: { events },
      } = await request(app).get(`/api/events?limit=2`).expect(200);
      expect(events.length).toBeLessThanOrEqual(2);
    });
    test("Should return 400 error for invalid sort_by parameter", async () => {
      const { body } = await request(app)
        .get("/api/events?sort_by=invalid_field")
        .expect(400);
      expect(body.msg).toBe(
        "Invalid sort_by query: invalid_field is not a valid sort parameter"
      );
    });
    test("Should return 400 error for invalid order parameter", async () => {
      const { body } = await request(app)
        .get("/api/events?order=invalid_order")
        .expect(400);
      expect(body.msg).toBe(
        "Invalid order query: invalid_order is not a valid order parameter"
      );
    });
  });
  describe("GET /api/events/:id - Event Lookup by ID", () => {
    test("Should return an event by its ID", async () => {
      const {
        body: { event },
      } = await request(app).get(`/api/events/1`).expect(200);
      expect(event).toHaveProperty("id", 1);
      expect(event).toHaveProperty("status", "published");
      expect(event).toHaveProperty("title", "Tech Conference 2025");
      expect(event).toHaveProperty(
        "description",
        "A conference for tech enthusiasts."
      );
      expect(event).toHaveProperty(
        "event_img_url",
        "https://c5znixeqj7.ufs.sh/f/Jf9D0EOZjwR5Q6eqKswUm9ctU0Xq42npAbSlV5j38hY6TkdR"
      );
      expect(event).toHaveProperty("location", "New York");
      expect(event).toHaveProperty("start_time", expect.any(String));
      expect(event).toHaveProperty("end_time", expect.any(String));
      expect(event).toHaveProperty("max_attendees", 200);
      expect(event).toHaveProperty("price", 49.99);
      expect(event).toHaveProperty("category", "Conference");
      expect(event).toHaveProperty("is_public", true);
      expect(event).toHaveProperty("team_id", 1);
      expect(event).toHaveProperty("created_by", 1);
      expect(event).toHaveProperty("created_at", expect.any(String));
      expect(event).toHaveProperty("updated_at", expect.any(String));
    });
    test("Draft event should not be visible to a non-team member", async () => {
      const { body } = await request(app)
        .get(`/api/events/2`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(404);
      expect(body.msg).toBe("Event not found");
    });
    test("Should return 404 error for non-existent event ID", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/events/9999").expect(404);
      expect(msg).toBe("Event not found");
    });
  });
  describe("GET /api/events/:id/draft - Draft Event Lookup by ID", () => {
    test("Draft event should be visible to a team member", async () => {
      const { body } = await request(app)
        .get(`/api/events/2/draft`)
        .set("Authorization", `Bearer ${bobToken}`)
        .expect(200);
      expect(body.event.id).toBe(2);
    });
    test("Non-team member should not see draft event by ID", async () => {
      const { body } = await request(app)
        .get(`/api/events/2/draft`)
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(404);

      expect(body.msg).toBe(
        "Draft event not found or you don't have access to it"
      );
    });
  });
  describe("GET /api/events/draft - Draft Events", () => {
    test("Draft events should not be visible to members who are not in a team or part of the team it belongs to", async () => {
      const { body } = await request(app)
        .get("/api/events/draft")
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(403);
      expect(body.msg).toBe("Forbidden - You are not a member of this team");
    });
  });
  describe("GET /api/events/upcoming - Upcoming Events", () => {
    test("Should successfully retrieve upcoming events", async () => {
      const {
        body: { events },
      } = await request(app).get("/api/events/upcoming").expect(200);
      const currentTime = new Date();
      const upcomingEvents = events.filter(
        (event: EventResponse) => new Date(event.start_time) > currentTime
      );
      expect(events).toBeInstanceOf(Array);
      expect(upcomingEvents.length).toBeGreaterThan(0);
    });
  });
  describe("GET /api/events/team/:teamId - Events by Team ID", () => {
    test("Should successfully retrieve events for a valid team ID", async () => {
      const {
        body: { events },
      } = await request(app).get("/api/events/team/1").expect(200);
      expect(events).toBeInstanceOf(Array);

      events.forEach((event: EventResponse) => {
        expect(event.team_id).toBe(1);
        expect(event.team_name).toBe("Tech Events Team");
      });
    });
    test("Team member should see only their team's published events in team listing", async () => {
      const { body } = await request(app)
        .get("/api/events/team/1")
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(200);

      body.events.forEach((event: EventResponse) => {
        expect(event.status).not.toBe("draft");
      });
    });
    test("Team member should see only their team's draft events in teams draft listing", async () => {
      const { body } = await request(app)
        .get("/api/events/team/1/draft")
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(200);
      body.events.forEach((event: EventResponse) => {
        expect(event.status).toBe("draft");
      });
    });
    test("Should not return other team's draft events", async () => {
      const { body } = await request(app)
        .get("/api/events/team/2/draft")
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(200);
      expect(body.events.length).toBe(0);
    });
    test("Should only return drafts events for the team in the team listing", async () => {
      const { body } = await request(app)
        .get("/api/events/team/1")
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(200);
      body.events.forEach((event: EventResponse) => {
        expect(event.team_id).toBe(1);
      });
    });
    test("Should return 404 error for non-existent team ID", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/events/team/9999").expect(404);
      expect(msg).toBe("Team not found");
    });
    test("Should not return any draft events for a user that is not a team member", async () => {
      const {
        body: { events },
      } = await request(app)
        .get("/api/events/team/1")
        .set("Authorization", `Bearer ${regularuserToken}`)
        .expect(200);

      events.forEach((event: EventResponse) => {
        expect(event.status).not.toBe("draft");
      });
    });
  });
  describe("POST /api/events - Event Creation", () => {
    test("Should successfully create events with various configurations", async () => {
      const token = await getAuthToken();
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
      const token = await getAuthToken();
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
      const missingFieldsEvent = {
        status: "published",
        // title is missing
        location: "Test Location",
        team_id: 1,
        category: "Conference",
      };

      const missingFieldsResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${aliceToken}`)
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
    });
    test("Should not allow creating events in the past", async () => {
      const token = await getAuthToken();
      const invalidTimesEvent = {
        status: "published",
        title: "Invalid Times Event",
        description: "Event with invalid times",
        location: "Test Location",
        team_id: 1,
        start_time: new Date(Date.now() + 172800000).toISOString(),
        end_time: new Date(Date.now() + 86400000).toISOString(),
        category: "Conference",
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
    test("Should not allow regular users to create events", async () => {
      const unauthorizedEvent = {
        title: "Unauthorized Event",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 1,
        category: "Conference",
      };

      const unauthorizedResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${regularuserToken}`)
        .send(unauthorizedEvent)
        .expect(403);

      expect(unauthorizedResponse.body.status).toBe("error");
      expect(unauthorizedResponse.body.msg).toBe(
        "Forbidden - You are not a member of any team"
      );
    });
    test("Should not allow users to create events for other teams", async () => {
      const unauthorizedEvent = {
        title: "Unauthorized Event",
        start_time: new Date(Date.now() + 86400000).toISOString(),
        end_time: new Date(Date.now() + 172800000).toISOString(),
        team_id: 2,
        category: "Conference",
      };
      const unauthorizedResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${aliceToken}`)
        .send(unauthorizedEvent)
        .expect(403);
      expect(unauthorizedResponse.body.status).toBe("error");
      expect(unauthorizedResponse.body.msg).toBe(
        "Forbidden - You don't have permission to create events for this team"
      );
    });
  });
  describe("PATCH /api/events/:id - Event Update", () => {
    test("Should successfully update events with various changes", async () => {
      const basicUpdateData = {
        title: "Updated Event Title",
        description: "Updated description",
        status: "published",
      };
      const {
        body: { updatedEvent },
      } = await request(app)
        .patch(`/api/events/9`)
        .set("Authorization", `Bearer ${siteadminToken}`)
        .send(basicUpdateData)
        .expect(200);
      expect(updatedEvent.title).toBe(basicUpdateData.title);
      expect(updatedEvent.description).toBe(basicUpdateData.description);
    });
    test("Should accept event_img_url as a partial update", async () => {
      const token = await getAuthToken();
      const updateData = {
        event_img_url: "https://example.com/event-image.jpg",
      };
      const {
        body: { updatedEvent },
      } = await request(app)
        .patch(`/api/events/1`)
        .set("Authorization", `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(updatedEvent.event_img_url).toBe(updateData.event_img_url);
    });
    test("Should return 404 error for non-existent event ID", async () => {
      const nonExistentResponse = await request(app)
        .patch("/api/events/9999")
        .set("Authorization", `Bearer ${siteadminToken}`)
        .send({ title: "Update Non-existent Event" })
        .expect(404);
      expect(nonExistentResponse.body.msg).toBe("Event not found");
    });
    test("Should return error message when the start time is after the end time", async () => {
      const invalidTimeUpdate = {
        start_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        end_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      };
      const timeUpdateResponse = await request(app)
        .patch(`/api/events/2`)
        .set("Authorization", `Bearer ${siteadminToken}`)
        .send(invalidTimeUpdate)
        .expect(400);
      expect(timeUpdateResponse.body.status).toBe("error");
      expect(timeUpdateResponse.body.msg).toBe(
        "End time must be after start time"
      );
    });
    test("Should enforce permissions for event updates", async () => {
      const updateData = { title: "Unauthorized Update Attempt" };
      const response = await request(app)
        .patch(`/api/events/1`)
        .set("Authorization", `Bearer ${charlieToken}`)
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
      await request(app)
        .delete(`/api/events/1`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(204);

      await request(app).get(`/api/events/1`).expect(404);
    });
    test("Should return 404 error for non-existent event ID", async () => {
      const { body } = await request(app)
        .delete(`/api/events/9999`)
        .set("Authorization", `Bearer ${aliceToken}`)
        .expect(404);

      expect(body.msg).toBe("Event not found");
    });
    test("Should enforce permissions for event deletion", async () => {
      const response = await request(app)
        .delete(`/api/events/1`)
        .set("Authorization", `Bearer ${charlieToken}`)
        .expect(403);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe(
        "Forbidden - You don't have permission to delete this event"
      );
    });
  });
});
