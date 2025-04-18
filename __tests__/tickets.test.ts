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
import { TicketResponse, TicketWithEventInfo } from "../types";
import * as ticketModels from "../models/tickets-models";
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

describe("Tickets API Endpoints", () => {
  describe("GET /api/tickets - Ticket Listing", () => {
    test("Should successfully retrieve a list of all tickets", async () => {
      const {
        body: { tickets },
      } = await request(app).get("/api/tickets").expect(200);
      expect(tickets).toBeInstanceOf(Array);
      expect(tickets.length).toBeGreaterThanOrEqual(1);

      tickets.forEach((ticket: TicketResponse) => {
        expect(ticket).toHaveProperty("id", expect.any(Number));
        expect(ticket).toHaveProperty("event_id", expect.any(Number));
        expect(ticket).toHaveProperty("user_id", expect.any(Number));
        expect(ticket).toHaveProperty("registration_id", expect.any(Number));
        expect(ticket).toHaveProperty("ticket_code", expect.any(String));
        expect(ticket).toHaveProperty("status", expect.any(String));
      });
    });
  });
  describe("GET /api/tickets/:id - Ticket Lookup by ID", () => {
    test("Should successfully retrieve a ticket when provided a valid ID", async () => {
      const {
        body: { ticket },
      } = await request(app).get("/api/tickets/1").expect(200);
      expect(ticket).toHaveProperty("id", 1);
      expect(ticket).toHaveProperty("event_id", expect.any(Number));
      expect(ticket).toHaveProperty("user_id", expect.any(Number));
      expect(ticket).toHaveProperty("ticket_code", expect.any(String));
    });
    test("Should return appropriate error when ticket ID does not exist", async () => {
      const {
        body: { msg },
      } = await request(app).get("/api/tickets/9999").expect(404);
      expect(msg).toBe("Ticket not found");
    });
  });
  describe("GET /api/tickets/user/:userId - Tickets by User ID", () => {
    test("Should successfully retrieve tickets for a valid user", async () => {
      const token = await getAuthToken();
      const {
        body: { tickets },
      } = await request(app)
        .get("/api/tickets/user/1") // Using alice123's ID (1) instead of user_id 3
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      expect(tickets).toBeInstanceOf(Array);

      if (tickets.length > 0) {
        tickets.forEach((ticket: TicketWithEventInfo) => {
          expect(ticket.user_id).toBe(1);
          expect(ticket).toHaveProperty("event_title", expect.any(String));
        });
      }
    });
    test("Should return appropriate error when user does not exist", async () => {
      const token = await getAuthToken();
      const {
        body: { msg },
      } = await request(app)
        .get("/api/tickets/user/9999")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
      expect(msg).toBe("User not found");
    });
  });
  describe("GET /api/tickets/verify/:ticketCode - Ticket Verification", () => {
    test("Should successfully verify a valid ticket", async () => {
      // First, get a valid ticket code from the tickets listing
      const {
        body: { tickets },
      } = await request(app).get("/api/tickets").expect(200);

      // Find a valid ticket
      const validTicket = tickets.find(
        (ticket: TicketResponse) => ticket.status === "valid"
      );

      if (validTicket) {
        const {
          body: { status, msg },
        } = await request(app)
          .get(`/api/tickets/verify/${validTicket.ticket_code}`)
          .expect(200);

        expect(status).toBe("success");
        expect(msg).toBe("Ticket is valid");
      } else {
        // Skip test if no valid tickets are found
        console.log("No valid tickets found for verification test");
      }
    });
    test("Should return appropriate error when ticket code does not exist", async () => {
      const {
        body: { msg },
      } = await request(app)
        .get("/api/tickets/verify/nonexistentticketcode123")
        .expect(404);
      expect(msg).toBe("Ticket not found");
    });
    test("Should reject verification for tickets with non-valid status", async () => {
      const token = await getAuthToken();
      // Create a ticket first
      const newTicket = {
        event_id: 1,
        user_id: 2,
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send(newTicket)
        .expect(201);

      const ticketId = createResponse.body.ticket.id;
      const ticketCode = createResponse.body.ticket.ticket_code;

      // Update the ticket to a non-valid status
      await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "cancelled" })
        .expect(200);

      // Now try to verify the cancelled ticket
      const verifyResponse = await request(app)
        .get(`/api/tickets/verify/${ticketCode}`)
        .expect(400);

      expect(verifyResponse.body.status).toBe("error");
      expect(verifyResponse.body.msg).toBe("Ticket is cancelled");
    });
    test("Should reject verification for tickets to events that have already ended", async () => {
      const token = await getAuthToken();
      // Create a ticket
      const newTicket = {
        event_id: 1,
        user_id: 2,
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send(newTicket)
        .expect(201);

      const ticketCode = createResponse.body.ticket.ticket_code;

      // Mock the event end_time to be in the past
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1); // Yesterday

      // Store the original implementation
      const originalFetchTicketByCode = ticketModels.fetchTicketByCode;

      // Use jest spyOn to intercept the fetchTicketByCode call and modify the response
      const spy = jest
        .spyOn(ticketModels, "fetchTicketByCode")
        .mockImplementation(async () => {
          const ticket = await originalFetchTicketByCode(ticketCode);
          return {
            ...ticket,
            end_time: pastDate.toISOString(),
          };
        });

      try {
        // Now try to verify the ticket for an event that has ended
        const verifyResponse = await request(app)
          .get(`/api/tickets/verify/${ticketCode}`)
          .expect(400);

        expect(verifyResponse.body.status).toBe("error");
        expect(verifyResponse.body.msg).toBe("Event has already ended");
      } finally {
        // Restore the original function
        spy.mockRestore();
      }
    });
  });
  describe("POST /api/tickets - Ticket Creation", () => {
    test("Should successfully create a new ticket with valid details", async () => {
      const token = await getAuthToken();
      const newTicket = {
        event_id: 1,
        user_id: 1,
        registration_id: 1,
      };

      const {
        body: { status, msg, ticket },
      } = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send(newTicket)
        .expect(201);

      expect(status).toBe("success");
      expect(msg).toBe("Ticket created successfully");
      expect(ticket).toHaveProperty("id", expect.any(Number));
      expect(ticket).toHaveProperty("ticket_code", expect.any(String));
      expect(ticket).toHaveProperty("status", "valid");
      expect(ticket.event_id).toBe(newTicket.event_id);
      expect(ticket.user_id).toBe(newTicket.user_id);
      expect(ticket.registration_id).toBe(newTicket.registration_id);
    });
    test("Should reject ticket creation when required fields are missing", async () => {
      const token = await getAuthToken();
      const {
        body: { status, msg, errors },
      } = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(status).toBe("error");
      expect(msg).toBe("Missing required fields");
      expect(errors).toContain("Event ID is required");
      expect(errors).toContain("User ID is required");
      expect(errors).toContain("Registration ID is required");
    });
  });
  describe("PATCH /api/tickets/:id - Ticket Status Update", () => {
    test("Should successfully update a ticket status", async () => {
      const token = await getAuthToken();
      // Create a ticket to update
      const newTicket = {
        event_id: 1,
        user_id: 2,
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send(newTicket)
        .expect(201);

      const ticketId = createResponse.body.ticket.id;

      // Update the ticket
      const {
        body: { status, msg, ticket },
      } = await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "used" })
        .expect(200);

      expect(status).toBe("success");
      expect(msg).toBe("Ticket updated successfully");
      expect(ticket.status).toBe("used");
    });
    test("Should reject status update with invalid status", async () => {
      const token = await getAuthToken();
      const {
        body: { status, msg },
      } = await request(app)
        .patch("/api/tickets/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "invalid_status" })
        .expect(400);

      expect(status).toBe("error");
      expect(msg).toBe("Invalid ticket status");
    });
  });
  describe("POST /api/tickets/use/:ticketCode - Mark Ticket as Used", () => {
    test("Should successfully mark a valid ticket as used", async () => {
      const token = await getAuthToken();
      // First create a valid ticket
      const newTicket = {
        event_id: 1,
        user_id: 1, // Using alice123's ID
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send(newTicket)
        .expect(201);

      const ticketCode = createResponse.body.ticket.ticket_code;

      // Now mark it as used
      const {
        body: { status, msg, ticket },
      } = await request(app)
        .post(`/api/tickets/use/${ticketCode}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(status).toBe("success");
      expect(msg).toBe("Ticket marked as used");
      expect(ticket.status).toBe("used");
    });
    test("Should return appropriate error when ticket code does not exist", async () => {
      const token = await getAuthToken();
      const {
        body: { status, msg },
      } = await request(app)
        .post("/api/tickets/use/nonexistentticketcode123")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
      expect(msg).toBe("Ticket not found");
    });
    test("Should reject attempt to use a ticket that has already been used", async () => {
      const token = await getAuthToken();
      // First create a valid ticket
      const newTicket = {
        event_id: 1,
        user_id: 1, // Using alice123's ID
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send(newTicket)
        .expect(201);

      const ticketCode = createResponse.body.ticket.ticket_code;

      // First use
      await request(app)
        .post(`/api/tickets/use/${ticketCode}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // Second use (should fail)
      const {
        body: { status, msg },
      } = await request(app)
        .post(`/api/tickets/use/${ticketCode}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(status).toBe("error");
      expect(msg).toBe("Ticket has already been used");
    });
    test("Should reject attempt to use a ticket with non-valid status", async () => {
      const token = await getAuthToken();
      // First create a valid ticket
      const newTicket = {
        event_id: 1,
        user_id: 1, // Using alice123's ID
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send(newTicket)
        .expect(201);

      const ticketId = createResponse.body.ticket.id;
      const ticketCode = createResponse.body.ticket.ticket_code;

      // Change status to cancelled
      await request(app)
        .patch(`/api/tickets/${ticketId}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ status: "cancelled" })
        .expect(200);

      // Try to use the cancelled ticket
      const {
        body: { status, msg },
      } = await request(app)
        .post(`/api/tickets/use/${ticketCode}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(status).toBe("error");
      expect(msg).toBe("Cannot use ticket with status: cancelled");
    });
  });
  describe("DELETE /api/tickets/:id - Ticket Deletion", () => {
    test("Should successfully delete a ticket with valid ID", async () => {
      const token = await getAuthToken();
      // First create a ticket to delete
      const newTicket = {
        event_id: 1,
        user_id: 1, // Using alice123's ID
        registration_id: 1,
      };

      const createResponse = await request(app)
        .post("/api/tickets")
        .set("Authorization", `Bearer ${token}`)
        .send(newTicket)
        .expect(201);

      const ticketIdToDelete = createResponse.body.ticket.id;

      // Delete the ticket
      await request(app)
        .delete(`/api/tickets/${ticketIdToDelete}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(204); // Note that the response code is 204 No Content
    });
    test("Should return appropriate error when attempting to delete non-existent ticket", async () => {
      const token = await getAuthToken();
      const {
        body: { msg },
      } = await request(app)
        .delete("/api/tickets/9999")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);
      expect(msg).toBe("Ticket not found");
    });
  });
  describe("GET /api/tickets/user/:userId/event/:eventId - Check if User Has Paid for Event", () => {
    test("Should return true when user has valid ticket for event", async () => {
      const token = await getAuthToken();
      // We know from test-data that user 3 has a valid ticket for event 1
      const response = await request(app)
        .get("/api/tickets/user/3/event/1")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
      console.log(response.body);
      expect(response.body).toHaveProperty("hasUserPaid", true);
    });

    test("Should return false when user doesn't have ticket for event", async () => {
      const token = await getAuthToken();
      // Create a new event for testing
      const adminToken = await getAuthToken(); // Using admin token to create event
      const newEvent = {
        status: "published",
        title: "Test Event for HasUserPaid",
        description: "An event for testing hasUserPaid",
        start_time: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end_time: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
        team_id: 1,
      };

      const eventResponse = await request(app)
        .post("/api/events")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(newEvent)
        .expect(201);

      const eventId = eventResponse.body.event.id;

      // Check if any user has paid for this new event (should be false)
      const response = await request(app)
        .get(`/api/tickets/user/1/event/${eventId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty("hasUserPaid", false);
    });

    test("Should return false when user has a cancelled ticket for event", async () => {
      const token = await getAuthToken();
      // We know from test-data that user 2 has a cancelled ticket for event 1
      const response = await request(app)
        .get("/api/tickets/user/2/event/1")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty("hasUserPaid", false);
    });

    test("Should handle invalid user ID", async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get("/api/tickets/user/invalid/event/1")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(response.body).toHaveProperty("status", "error");
    });

    test("Should handle invalid event ID", async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get("/api/tickets/user/1/event/invalid")
        .set("Authorization", `Bearer ${token}`)
        .expect(400);

      expect(response.body).toHaveProperty("status", "error");
    });

    test("Should return 404 for non-existent user", async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get("/api/tickets/user/9999/event/1")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty("msg", "User not found");
    });

    test("Should return 404 for non-existent event", async () => {
      const token = await getAuthToken();
      const response = await request(app)
        .get("/api/tickets/user/1/event/9999")
        .set("Authorization", `Bearer ${token}`)
        .expect(404);

      expect(response.body).toHaveProperty("msg", "Event not found");
    });
  });
});
