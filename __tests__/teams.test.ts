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
} from "../db/data/test-data/index";
import { TeamMember, TeamResponse } from "../types";
require("jest-sorted");
import { getAuthToken, getTokenForRole } from "../utils/testHelpers";

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

afterAll(async () => {
  await db.end();
});

describe("Teams API Endpoints", () => {
  describe("GET /api/teams - Team Listing", () => {
    test("Should successfully retrieve a list of teams", async () => {
      const token = await getAuthToken();

      const {
        body: { teams },
      } = await request(app)
        .get("/api/teams")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(teams).toBeInstanceOf(Array);
      if (teams.length > 0) {
        teams.forEach((team: TeamResponse) => {
          expect(team).toHaveProperty("id", expect.any(Number));
          expect(team).toHaveProperty("name", expect.any(String));
        });
      }
    });
    test("Should return the total number of teams", async () => {
      const token = await getAuthToken();

      const {
        body: { total_teams },
      } = await request(app)
        .get("/api/teams")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(total_teams).toBeGreaterThanOrEqual(1);
      expect(total_teams).toEqual(expect.any(Number));
    });
  });
  describe("GET /api/teams/:id - Team Lookup by ID", () => {
    test("Should successfully retrieve a team when provided a valid ID", async () => {
      const token = await getAuthToken();

      const {
        body: { team },
      } = await request(app)
        .get("/api/teams/1")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(team).toHaveProperty("id", 1);
      expect(team).toHaveProperty("name", expect.any(String));
    });
    test("Should return appropriate error when team ID does not exist", async () => {
      const token = await getAuthToken();

      const {
        body: { msg },
      } = await request(app)
        .get("/api/teams/999")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(msg).toBe("Team not found");
    });
  });
  describe("GET /api/teams/:id/members - Team Members", () => {
    test("Should successfully retrieve team members", async () => {
      const token = await getAuthToken();

      const response = await request(app)
        .get("/api/teams/1/members")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const { members, total_members } = response.body;

      expect(members).toBeInstanceOf(Array);
      expect(total_members).toEqual(expect.any(Number));
    });
    test("Should return appropriate error when team ID does not exist", async () => {
      const token = await getAuthToken();

      const {
        body: { msg },
      } = await request(app)
        .get("/api/teams/999/members")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(msg).toBe("Team not found");
    });
  });
  describe("GET /api/teams/members - Team Members Listing", () => {
    test("Should successfully retrieve a list of all team members", async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const { teamMembers, total_team_members } = response.body;

      expect(teamMembers).toBeInstanceOf(Array);
      expect(total_team_members).toEqual(expect.any(Number));
      teamMembers.forEach((teamMember: TeamMember) => {
        expect(teamMember).toHaveProperty("id", expect.any(Number));
        expect(teamMember).toHaveProperty("user_id", expect.any(Number));
        expect(teamMember).toHaveProperty("team_id", expect.any(Number));
      });
    });
  });
  describe("GET /api/teams/members/:id - Team Member Lookup by ID", () => {
    test("Should successfully retrieve a team member when provided a valid ID", async () => {
      const token = await getAuthToken();
      const {
        body: { teamMember },
      } = await request(app)
        .get("/api/teams/members/1")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(teamMember).toHaveProperty("id", 1);
    });
    test("Should return appropriate error when team member ID does not exist", async () => {
      const token = await getAuthToken();
      const {
        body: { msg },
      } = await request(app)
        .get("/api/teams/members/9999")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
      expect(msg).toBe("Team member not found");
    });
  });
  describe("GET /api/teams/members/user/:userId - Team Member Lookup by User ID", () => {
    test("Should successfully retrieve a team member when provided a valid user ID", async () => {
      const token = await getAuthToken();
      const {
        body: { teamMember },
      } = await request(app)
        .get("/api/teams/members/user/1")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(teamMember).toHaveProperty("user_id", 1);
      expect(teamMember).toHaveProperty("team_id", expect.any(Number));
      expect(teamMember).toHaveProperty("role", expect.any(String));
    });
    test("Should return appropriate error when user has no team member record", async () => {
      const token = await getAuthToken();
      // Using a user ID that doesn't have a team member record (use a high number to avoid conflicts)
      const {
        body: { msg },
      } = await request(app)
        .get("/api/teams/members/user/9999")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
      expect(msg).toBe("Team member not found");
    });
  });
  describe("GET /api/teams/members/:userId/role - Team Member Role Lookup by User ID", () => {
    test("Should successfully retrieve a team member role when provided a valid user ID", async () => {
      const token = await getAuthToken();
      const {
        body: { role },
      } = await request(app)
        .get("/api/teams/members/1/role")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(role).toBe("team_admin");
    });
    test("Should return appropriate error when user has no team member record", async () => {
      const token = await getAuthToken();
      const {
        body: { msg },
      } = await request(app)
        .get("/api/teams/members/9999/role")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
      expect(msg).toBe("Team member not found");
    });
  });
  describe("POST /api/teams - Team Creation", () => {
    test("Should successfully create a new team with valid details", async () => {
      const adminToken = await getTokenForRole("team_admin");
      const newTeam = {
        name: "New Test Team",
        description: "This is a test team created for testing",
      };

      const {
        body: { team },
      } = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(newTeam)
        .expect(201);

      expect(team).toHaveProperty("id", expect.any(Number));
      expect(team).toHaveProperty("name", newTeam.name);
      expect(team).toHaveProperty("description", newTeam.description);
    });
    test("Should return appropriate error when required fields are missing", async () => {
      const adminToken = await getTokenForRole("team_admin");
      const invalidTeam = {
        // Missing 'name' field
        description: "This team is missing a name",
      };

      const {
        body: { errors },
      } = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(invalidTeam)
        .expect(400);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Team name is required",
          }),
        ])
      );
    });
    test("Should reject team creation when name is already in use", async () => {
      const adminToken = await getTokenForRole("team_admin");
      const duplicateTeam = {
        name: "Tech Events Team",
        description: "Team for tech events and promotions",
      };
      const {
        body: { msg },
      } = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(duplicateTeam)
        .expect(400);
      expect(msg).toBe("Team name already exists");
    });
  });
  describe("POST /api/teams/members - Team Member Creation", () => {
    test("Should successfully create a new team member with valid details", async () => {
      const token = await getAuthToken();
      const insertedTeamMember = {
        user_id: 3, // Changed from 1 to 3 to avoid duplicate constraint with team_id 1
        team_id: 1,
        role: "team_admin",
      };
      const {
        body: { newTeamMember },
      } = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .send(insertedTeamMember)
        .expect(201);
      expect(newTeamMember).toHaveProperty("id", expect.any(Number));
      expect(newTeamMember).toHaveProperty("user_id", 3);
      expect(newTeamMember).toHaveProperty("team_id", 1);
      expect(newTeamMember).toHaveProperty("role", "team_admin");
    });
    test("Should reject team member creation when user does not exist", async () => {
      const token = await getAuthToken();
      const nonExistentUserTeamMember = {
        user_id: 9999, // This ID doesn't exist in the test data
        team_id: 1,
        role: "event_manager",
      };

      const response = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .send(nonExistentUserTeamMember)
        .expect(404);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe(
        "User not found. Cannot create team member for non-existent user."
      );
    });
    test("Should support creating a new user and team member simultaneously", async () => {
      const token = await getAuthToken();
      const newUserTeamMember = {
        username: "newteamuser",
        email: "newteam@example.com",
        plainPassword: "password123",
        team_id: 1,
        role: "event_manager",
      };

      const response = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
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
    test("Should reject team member creation when role is missing with existing user", async () => {
      const token = await getAuthToken();
      const missingRoleTeamMember = {
        user_id: 3,
        team_id: 1,
        // role is missing
      };

      const response = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .send(missingRoleTeamMember)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Role is required",
          }),
        ])
      );
    });
    test("Should reject team member creation when team_id is missing with existing user", async () => {
      const token = await getAuthToken();
      const missingTeamIdTeamMember = {
        user_id: 3,
        role: "team_admin",
        // team_id is missing
      };

      const response = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .send(missingTeamIdTeamMember)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Team ID is required",
          }),
        ])
      );
    });
    test("Should reject new user team member creation when required fields are missing", async () => {
      const token = await getAuthToken();
      // Missing username
      const missingUsernameTeamMember = {
        // username is missing
        email: "newmember@example.com",
        plainPassword: "password123",
        team_id: 1,
        role: "team_admin",
      };

      const response1 = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .send(missingUsernameTeamMember)
        .expect(400);

      expect(response1.body.status).toBe("error");
      // Cannot check for specific message since it's handled by validator now
      expect(response1.body).toHaveProperty("errors");

      // Missing email
      const missingEmailTeamMember = {
        username: "newmemberuser",
        // email is missing
        plainPassword: "password123",
        team_id: 1,
        role: "team_admin",
      };

      const response2 = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .send(missingEmailTeamMember)
        .expect(400);

      expect(response2.body.status).toBe("error");
      expect(response2.body).toHaveProperty("errors");

      // Missing password
      const missingPasswordTeamMember = {
        username: "newmemberuser",
        email: "newmember@example.com",
        // password is missing
        team_id: 1,
        role: "team_admin",
      };

      const response3 = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .send(missingPasswordTeamMember)
        .expect(400);

      expect(response3.body.status).toBe("error");
      expect(response3.body).toHaveProperty("errors");
    });
    test("Should reject new user team member creation when username is already in use", async () => {
      const token = await getAuthToken();
      // Use an existing username from the seed data instead of creating one
      const duplicateUsernameTeamMember = {
        username: "alice123", // This username already exists in seed data
        email: "another@example.com", // Different email
        plainPassword: "password123",
        team_id: 1,
        role: "team_admin",
      };

      const response = await request(app)
        .post("/api/teams/members")
        .set("Authorization", `Bearer ${token}`)
        .send(duplicateUsernameTeamMember)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.msg).toBe(
        "Failed to create new user. Username or email may already be in use."
      );
    });
  });
  describe("PATCH /api/teams/:id - Team Update", () => {
    test("Should successfully update a team with valid details", async () => {
      const token = await getAuthToken();
      const updatedTeamData = {
        name: "Updated Team Name",
        description: "Updated team description",
      };
      const {
        body: { updatedTeam },
      } = await request(app)
        .patch("/api/teams/1")
        .set("Authorization", `Bearer ${token}`)
        .send(updatedTeamData)
        .expect(200);
      expect(updatedTeam).toHaveProperty("id", 1);
      expect(updatedTeam.name).toBe("Updated Team Name");
      expect(updatedTeam.description).toBe("Updated team description");
    });
    test("Should return appropriate error when attempting to update non-existent team", async () => {
      const token = await getAuthToken();
      const updatedTeamData = {
        name: "This Won't Work",
        description: "Because the team doesn't exist",
      };
      const {
        body: { msg },
      } = await request(app)
        .patch("/api/teams/9999")
        .set("Authorization", `Bearer ${token}`)
        .send(updatedTeamData)
        .expect(404);
      expect(msg).toBe("Team not found");
    });
    test("Should reject update when name is missing", async () => {
      const token = await getAuthToken();
      const missingNameData = {
        description: "This team update will fail because name is missing",
      };

      const response = await request(app)
        .patch("/api/teams/1")
        .set("Authorization", `Bearer ${token}`)
        .send(missingNameData)
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Team name is required",
          }),
        ])
      );
    });
    test("Should reject update with empty request body", async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .patch("/api/teams/1")
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.status).toBe("error");
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: "Team name is required",
          }),
        ])
      );
    });
  });
  describe("DELETE /api/teams/:id - Team Deletion", () => {
    test("Should successfully delete a team with valid ID", async () => {
      const token = await getAuthToken();
      const newTeam = {
        name: "Team to Delete",
        description: "This team will be deleted",
      };
      const createResponse = await request(app)
        .post("/api/teams")
        .set("Authorization", `Bearer ${token}`)
        .send(newTeam);
      const teamIdToDelete = createResponse.body.team.id;
      // Delete the team
      await request(app)
        .delete(`/api/teams/${teamIdToDelete}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204);
      // Verify the team is deleted
      await request(app).get(`/api/teams/${teamIdToDelete}`).expect(404);
    });
    test("Should return appropriate error when attempting to delete non-existent team", async () => {
      const token = await getAuthToken();
      const {
        body: { msg },
      } = await request(app)
        .delete("/api/teams/9999")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
      expect(msg).toBe("Team not found");
    });
  });
});
