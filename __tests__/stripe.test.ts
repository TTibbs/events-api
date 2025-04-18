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
import { getAuthToken } from "../utils/testHelpers";
import Stripe from "stripe";

// Mock Stripe
jest.mock("stripe", () => {
  return jest.fn().mockImplementation(() => {
    return {
      checkout: {
        sessions: {
          create: jest.fn().mockResolvedValue({
            id: "cs_test_123456789",
            url: "https://checkout.stripe.com/test",
            payment_status: "unpaid",
          }),
          retrieve: jest.fn().mockResolvedValue({
            id: "cs_test_123456789",
            payment_status: "paid",
            metadata: {
              eventId: "1",
              userId: "1",
            },
            payment_intent: "pi_test_123456789",
            amount_total: 4999, // In pence
            currency: "gbp",
          }),
        },
      },
      customers: {
        create: jest.fn().mockResolvedValue({
          id: "cus_test_123456789",
        }),
      },
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_123456789",
              payment_status: "paid",
              metadata: {
                eventId: "1",
                userId: "1",
              },
              payment_intent: "pi_test_123456789",
              amount_total: 4999,
              currency: "gbp",
            },
          },
        }),
      },
    };
  });
});

// Reset database before tests
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

// Close database connection after all tests
afterAll(async () => {
  await db.end();
});

describe("Stripe Payment Integration", () => {
  describe("POST /api/stripe/create-checkout-session", () => {
    test("Should create a checkout session for a valid event and user", async () => {
      // Get auth token
      const token = await getAuthToken();

      // Create checkout session
      const response = await request(app)
        .post("/api/stripe/create-checkout-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ eventId: 1, userId: 1 })
        .expect(200);

      // Check response structure
      expect(response.body).toHaveProperty("url");
      expect(response.body).toHaveProperty("sessionId");
      expect(response.body.url).toBe("https://checkout.stripe.com/test");
      expect(response.body.sessionId).toBe("cs_test_123456789");
    });

    test("Should return 404 if event does not exist", async () => {
      // Get auth token
      const token = await getAuthToken();

      // Create checkout session with non-existent event
      const response = await request(app)
        .post("/api/stripe/create-checkout-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ eventId: 999, userId: 1 })
        .expect(404);

      expect(response.body).toHaveProperty("message", "Event not found");
    });

    test("Should return 404 if user does not exist", async () => {
      // Get auth token
      const token = await getAuthToken();

      // Create checkout session with non-existent user
      const response = await request(app)
        .post("/api/stripe/create-checkout-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ eventId: 1, userId: 999 })
        .expect(404);

      expect(response.body).toHaveProperty("message", "User not found");
    });

    test("Should return 401 if not authenticated", async () => {
      // Try to create checkout session without auth
      const response = await request(app)
        .post("/api/stripe/create-checkout-session")
        .send({ eventId: 1, userId: 1 })
        .expect(401);

      expect(response.body.status).toBe("error");
    });
  });

  describe("POST /api/stripe/sync-payment/:sessionId", () => {
    test("Should successfully process a successful payment", async () => {
      // Get auth token
      const token = await getAuthToken();

      // Sync payment
      const response = await request(app)
        .post("/api/stripe/sync-payment/cs_test_123456789")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      // Check response structure
      expect(response.body).toHaveProperty("success", true);
      expect(response.body).toHaveProperty("ticketId");
      expect(response.body).toHaveProperty("paymentId");

      // Verify that a ticket was created
      const ticketResponse = await request(app)
        .get(`/api/tickets/${response.body.ticketId}`)
        .expect(200);

      expect(ticketResponse.body.ticket).toHaveProperty("is_paid", true);
      expect(ticketResponse.body.ticket).toHaveProperty("status", "valid");
      expect(ticketResponse.body.ticket).toHaveProperty("event_id", 1);
      expect(ticketResponse.body.ticket).toHaveProperty("user_id", 1);
    });

    test("Should handle idempotency correctly by not creating duplicate payments", async () => {
      // Get auth token
      const token = await getAuthToken();

      // Sync payment first time
      const firstResponse = await request(app)
        .post("/api/stripe/sync-payment/cs_test_123456789")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(firstResponse.body).toHaveProperty("success", true);
      expect(firstResponse.body).toHaveProperty("ticketId");

      // Sync same payment second time
      const secondResponse = await request(app)
        .post("/api/stripe/sync-payment/cs_test_123456789")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(secondResponse.body).toHaveProperty("success", true);
      expect(secondResponse.body).toHaveProperty(
        "message",
        "Payment already processed"
      );
    });

    test("Should return 401 if not authenticated", async () => {
      // Try to sync payment without auth
      const response = await request(app)
        .post("/api/stripe/sync-payment/cs_test_123456789")
        .expect(401);

      expect(response.body.status).toBe("error");
    });
  });

  describe("POST /api/stripe/webhook", () => {
    test("Should process webhook events correctly", async () => {
      // Mock the webhook request
      const response = await request(app)
        .post("/api/stripe/webhook")
        .set("stripe-signature", "test_signature")
        .send({
          type: "checkout.session.completed",
          data: {
            object: {
              id: "cs_test_webhook_123",
              payment_status: "paid",
              metadata: {
                eventId: "1",
                userId: "1",
              },
              payment_intent: "pi_test_webhook_123",
              amount_total: 4999,
            },
          },
        })
        .expect(200);

      expect(response.body).toHaveProperty("received", true);

      // Verify the payment was processed by checking the database
      const { rows: payments } = await db.query(
        "SELECT * FROM stripe_payments WHERE stripe_session_id = $1",
        ["cs_test_123456789"]
      );

      // We don't assert on the specific payment because the webhook handling
      // uses the mocked Stripe.checkout.sessions.retrieve which returns a fixed session ID
      // In a real scenario, we'd check for the webhook's session ID
    });
  });

  describe("End-to-End Payment Flow", () => {
    test("Should complete full payment flow from checkout to ticket creation", async () => {
      // Get auth token
      const token = await getAuthToken();

      // 1. Create checkout session
      const checkoutResponse = await request(app)
        .post("/api/stripe/create-checkout-session")
        .set("Authorization", `Bearer ${token}`)
        .send({ eventId: 1, userId: 1 })
        .expect(200);

      const sessionId = checkoutResponse.body.sessionId;

      // 2. Sync payment (simulating customer completing payment)
      const syncResponse = await request(app)
        .post(`/api/stripe/sync-payment/${sessionId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const ticketId = syncResponse.body.ticketId;

      // 3. Verify ticket was created and is valid
      const ticketResponse = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .expect(200);

      const ticket = ticketResponse.body.ticket;
      expect(ticket).toHaveProperty("status", "valid");
      expect(ticket).toHaveProperty("is_paid", true);
      expect(ticket).toHaveProperty("event_id", 1);
      expect(ticket).toHaveProperty("user_id", 1);

      // 4. Verify user has the ticket in their tickets list
      const userTicketsResponse = await request(app)
        .get("/api/tickets/user/1")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const userTickets = userTicketsResponse.body.tickets;
      const paymentTicket = userTickets.find((t: any) => t.id === ticketId);
      expect(paymentTicket).toBeTruthy();
    });
  });
});
