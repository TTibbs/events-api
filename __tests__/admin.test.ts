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
  stripePayments,
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
    stripePayments,
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
      expect(response.body.data).toHaveProperty("total_team_members");
      expect(response.body.data).toHaveProperty("tickets");
      expect(response.body.data).toHaveProperty("registrations");

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

    test("200: Should return correct count values in the dashboard data", async () => {
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

      // Check that all count properties are numbers
      expect(typeof response.body.data.total_users).toBe("number");
      expect(typeof response.body.data.total_events).toBe("number");
      expect(typeof response.body.data.total_teams).toBe("number");
      expect(typeof response.body.data.total_team_members).toBe("number");

      // Check that count values match array lengths
      expect(response.body.data.total_users).toBe(
        response.body.data.users.length
      );
      expect(response.body.data.total_events).toBe(
        response.body.data.events.length
      );
      expect(response.body.data.total_teams).toBe(
        response.body.data.teams.length
      );

      // Make sure total_team_members is greater than zero (assuming test data has team members)
      expect(response.body.data.total_team_members).toBeGreaterThan(0);
    });
  });
  describe("PATCH /api/admin/users/:id", () => {
    test("200: Should promote user to admin when requested by a site admin", async () => {
      // Use user_id 4 which is a site admin in the test data
      const token = generateTestToken(
        4,
        "siteadmin",
        "siteadmin@example.com",
        null
      );

      const response = await request(app)
        .patch("/api/admin/users/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ is_site_admin: true })
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.is_site_admin).toBe(true);
      expect(response.body.data).not.toHaveProperty("password_hash");
    });
    test("200: Should demote a site admin to regular user", async () => {
      // Use user_id 4 which is a site admin in the test data
      const token = generateTestToken(
        4,
        "siteadmin",
        "siteadmin@example.com",
        null
      );

      const response = await request(app)
        .patch("/api/admin/users/3") // Assuming user 3 is already a site admin
        .set("Authorization", `Bearer ${token}`)
        .send({ is_site_admin: false })
        .expect(200);

      expect(response.body.status).toBe("success");
      expect(response.body.data.is_site_admin).toBe(false);
    });
    test("401: Should return unauthorized when no token is provided", async () => {
      const response = await request(app)
        .patch("/api/admin/users/1")
        .send({ is_site_admin: true })
        .expect(401);

      expect(response.body).toEqual({
        status: "error",
        msg: "Unauthorized - No token provided",
      });
    });
    test("403: Should return forbidden when non-admin user tries to promote someone", async () => {
      // Use user_id 1 which is not a site admin in the test data
      const token = generateTestToken(
        1,
        "alice123",
        "alice@example.com",
        "team_admin"
      );

      const response = await request(app)
        .patch("/api/admin/users/2")
        .set("Authorization", `Bearer ${token}`)
        .send({ is_site_admin: true })
        .expect(403);

      expect(response.body).toEqual({
        status: "error",
        msg: "Forbidden - Site admin access required",
      });
    });
    test("400: Should return bad request when is_site_admin is not a boolean", async () => {
      const token = generateTestToken(
        4,
        "siteadmin",
        "siteadmin@example.com",
        null
      );

      const response = await request(app)
        .patch("/api/admin/users/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ is_site_admin: "true" }) // String instead of boolean
        .expect(400);

      expect(response.body).toEqual({
        status: "error",
        msg: "Invalid request - is_site_admin must be a boolean value",
      });
    });
    test("404: Should return not found when user does not exist", async () => {
      const token = generateTestToken(
        4,
        "siteadmin",
        "siteadmin@example.com",
        null
      );

      const response = await request(app)
        .patch("/api/admin/users/999")
        .set("Authorization", `Bearer ${token}`)
        .send({ is_site_admin: true })
        .expect(404);

      expect(response.body).toEqual({
        status: "error",
        msg: "User not found",
      });
    });
  });
});
