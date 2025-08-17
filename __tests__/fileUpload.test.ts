import request from "supertest";
import app from "../app";
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
import { deleteImageFile, extractFilenameFromPath } from "../utils/fileUpload";
import { getAuthToken } from "../utils/testHelpers";

describe("File Upload Tests", () => {
  let authToken: string;
  let testEventId: number;

  beforeAll(async () => {
    // Get auth token for a user with team_admin role
    authToken = await getAuthToken("alice123");
  });

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
    // Clean up any uploaded files
    if (testEventId) {
      try {
        const eventResponse = await request(app)
          .get(`/api/events/${testEventId}/draft`)
          .set("Authorization", `Bearer ${authToken}`);

        if (eventResponse.body.event?.event_img_url) {
          const filename = extractFilenameFromPath(
            eventResponse.body.event.event_img_url
          );
          if (filename) {
            deleteImageFile(filename);
          }
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    await db.end();
  });

  describe("POST /api/events with file upload", () => {
    test("Should create event with uploaded image file", async () => {
      const eventData = {
        title: "Test Event with File Upload",
        description: "Test event with uploaded image",
        location: "Test Location",
        start_time: "2025-12-01T10:00:00Z",
        end_time: "2025-12-01T18:00:00Z",
        max_attendees: 100,
        price: 25.0,
        category: "Conference",
        is_public: true,
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .field("title", eventData.title)
        .field("description", eventData.description)
        .field("location", eventData.location)
        .field("start_time", eventData.start_time)
        .field("end_time", eventData.end_time)
        .field("max_attendees", eventData.max_attendees.toString())
        .field("price", eventData.price.toString())
        .field("category", eventData.category)
        .field("is_public", eventData.is_public.toString())
        .attach("event_image", Buffer.from("fake image data"), {
          filename: "test-image.jpg",
          contentType: "image/jpeg",
        });

      expect(response.status).toBe(201);
      expect(response.body.event).toHaveProperty("event_img_url");
      expect(response.body.event.event_img_url).toMatch(
        /^\/uploads\/event-images\/event-\d+-\d+\.jpg$/
      );

      testEventId = response.body.event.id;
    });

    test("Should create event with URL instead of file upload", async () => {
      const eventData = {
        title: "Test Event with URL",
        description: "Test event with URL image",
        location: "Test Location",
        start_time: "2025-12-02T10:00:00Z",
        end_time: "2025-12-02T18:00:00Z",
        max_attendees: 100,
        price: 25.0,
        category: "Conference",
        is_public: true,
        event_img_url: "https://example.com/test-image.jpg",
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send(eventData);

      expect(response.status).toBe(201);
      expect(response.body.event).toHaveProperty(
        "event_img_url",
        "https://example.com/test-image.jpg"
      );
    });

    test("Should reject non-image file upload", async () => {
      const eventData = {
        title: "Test Event with Invalid File",
        description: "Test event with invalid file",
        location: "Test Location",
        start_time: "2025-12-03T10:00:00Z",
        end_time: "2025-12-03T18:00:00Z",
        max_attendees: 100,
        price: 25.0,
        category: "Conference",
        is_public: true,
      };

      const response = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .field("title", eventData.title)
        .field("description", eventData.description)
        .field("location", eventData.location)
        .field("start_time", eventData.start_time)
        .field("end_time", eventData.end_time)
        .field("max_attendees", eventData.max_attendees.toString())
        .field("price", eventData.price.toString())
        .field("category", eventData.category)
        .field("is_public", eventData.is_public.toString())
        .attach("event_image", Buffer.from("fake text data"), {
          filename: "test-file.txt",
          contentType: "text/plain",
        });

      expect(response.status).toBe(400);
      expect(response.body.msg).toContain("Only image files are allowed");
    });
  });

  describe("PATCH /api/events with file upload", () => {
    test("Should update event with new uploaded image", async () => {
      // First create an event
      const createResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          title: "Test Event for Update",
          description: "Test event for update",
          location: "Test Location",
          start_time: "2025-12-04T10:00:00Z",
          end_time: "2025-12-04T18:00:00Z",
          max_attendees: 100,
          price: 25.0,
          category: "Conference",
          is_public: true,
        });

      const eventId = createResponse.body.event.id;

      // Update with new image
      const updateResponse = await request(app)
        .patch(`/api/events/${eventId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .field("title", "Updated Event Title")
        .attach("event_image", Buffer.from("updated image data"), {
          filename: "updated-image.jpg",
          contentType: "image/jpeg",
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.updatedEvent).toHaveProperty("event_img_url");
      expect(updateResponse.body.updatedEvent.event_img_url).toMatch(
        /^\/uploads\/event-images\/event-\d+-\d+\.jpg$/
      );
      expect(updateResponse.body.updatedEvent.title).toBe(
        "Updated Event Title"
      );
    });
  });
});
