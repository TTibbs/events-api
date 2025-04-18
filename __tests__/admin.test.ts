import request from "supertest";
import app from "../app";
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
import { generateTestToken } from "../utils/testHelpers";

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
afterAll(() => db.end());

describe("Admin API", () => {
  describe("GET /api/users/admin/dashboard", () => {
    test("401: Should return unauthorized when no token is provided", async () => {
      const response = await request(app)
        .get("/api/admin/dashboard")
        .expect(401);

      expect(response.body).toEqual({
        status: "error",
        msg: "Unauthorized - No token provided",
      });
    });

    test("403: Should return forbidden when user is not a site admin", async () => {
      // Get a non-admin user (user_id 1 is not an admin in the test data)
      const token = generateTestToken(
        1,
        "alice123",
        "alice@example.com",
        "team_admin"
      );

      const response = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);

      expect(response.body).toEqual({
        status: "error",
        msg: "Forbidden - Site admin access required",
      });
    });

    test("200: Should return all platform data for site admin", async () => {
      // Use user_id 4 which is a site admin in the test data
      const token = generateTestToken(
        4,
        "siteadmin",
        "siteadmin@example.com",
        null
      );

      const response = await request(app)
        .get("/api/admin/dashboard")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // Check structure of the response
      expect(response.body.status).toBe("success");
      expect(response.body.data).toHaveProperty("users");
      expect(response.body.data).toHaveProperty("total_users");
      expect(response.body.data).toHaveProperty("events");
      expect(response.body.data).toHaveProperty("total_events");
      expect(response.body.data).toHaveProperty("draft_events");
      expect(response.body.data).toHaveProperty("teams");
      expect(response.body.data).toHaveProperty("total_teams");
      expect(response.body.data).toHaveProperty("tickets");
      expect(response.body.data).toHaveProperty("registrations");

      // Check data types and properties
      expect(Array.isArray(response.body.data.users)).toBe(true);
      expect(typeof response.body.data.total_users).toBe("number");
      expect(Array.isArray(response.body.data.events)).toBe(true);
      expect(typeof response.body.data.total_events).toBe("number");
      expect(Array.isArray(response.body.data.draft_events)).toBe(true);
      expect(Array.isArray(response.body.data.teams)).toBe(true);
      expect(typeof response.body.data.total_teams).toBe("number");
      expect(Array.isArray(response.body.data.tickets)).toBe(true);
      expect(Array.isArray(response.body.data.registrations)).toBe(true);

      // Check that users don't contain password_hash
      if (response.body.data.users.length > 0) {
        expect(response.body.data.users[0]).not.toHaveProperty("password_hash");
      }

      // Verify draft events are included
      const hasDraftEvents = response.body.data.draft_events.some(
        (event: any) => event.status === "draft"
      );
      expect(hasDraftEvents).toBe(true);
    });
  });
});
