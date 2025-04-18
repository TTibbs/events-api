import { Request, Response } from "express";
import Stripe from "stripe";
import db from "../db/connection";
import { generateUniqueCode } from "../utils/codeGenerator";
import { selectUserPayments } from "../models/stripe-models";
import {
  CheckoutSessionData,
  StripeSessionInfo,
  WebhookEvent,
  StripePayment,
} from "../types";

// Check if Stripe API key is available
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  console.warn(
    "⚠️ WARNING: STRIPE_SECRET_KEY environment variable is not set. Stripe payment features will not work."
  );
}

// Initialize Stripe with the secret key, use a dummy key in development if not provided
const stripe = new Stripe(
  stripeSecretKey || "sk_test_dummy_key_for_development_only",
  {
    apiVersion: "2025-03-31.basil",
  }
);

export const getPayments = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { userId } = req.params;

  const getUserPayments = await selectUserPayments(userId);
  res.send(getUserPayments);
};

export const createCheckoutSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sessionData: CheckoutSessionData = req.body;
  const { eventId, userId } = sessionData;

  // Check if Stripe is properly configured
  if (!stripeSecretKey) {
    res.status(503).send({
      message: "Stripe payment service unavailable - API key not configured",
      details:
        "The server administrator needs to set the STRIPE_SECRET_KEY environment variable",
    });
    return;
  }

  try {
    // Get event details from database
    const { rows: events } = await db.query(
      "SELECT * FROM events WHERE id = $1",
      [eventId]
    );

    if (!events.length) {
      res.status(404).send({ message: "Event not found" });
      return;
    }

    const event = events[0];

    // Create or get Stripe customer for this user
    const { rows: users } = await db.query(
      "SELECT * FROM users WHERE id = $1",
      [userId]
    );

    if (!users.length) {
      res.status(404).send({ message: "User not found" });
      return;
    }

    const user = users[0];
    let stripeCustomerId = user.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await db.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [
        stripeCustomerId,
        userId,
      ]);
    }

    // Create the checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "gbp", // Match the currency in your schema
            product_data: {
              name: `Ticket for ${event.title}`,
              description: event.description || "Event ticket",
            },
            unit_amount: Math.round(event.price * 100), // Convert to pence
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${
        process.env.FRONTEND_URL || "http://localhost:3000"
      }/events/${eventId}`,
      metadata: {
        eventId,
        userId,
      },
    });

    const sessionInfo: StripeSessionInfo = {
      url: session.url as string,
      sessionId: session.id,
    };
    res.send(sessionInfo);
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).send({ message: (error as Error).message });
  }
};

export const syncPaymentStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { sessionId } = req.params;

  // Check if Stripe is properly configured
  if (!stripeSecretKey) {
    res.status(503).send({
      message: "Stripe payment service unavailable - API key not configured",
      details:
        "The server administrator needs to set the STRIPE_SECRET_KEY environment variable",
    });
    return;
  }

  try {
    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Check if payment was successful
    if (session.payment_status === "paid") {
      const { eventId, userId } = session.metadata as {
        eventId: string;
        userId: string;
      };

      // Check if a payment record already exists
      const { rows: existingPayments } = await db.query(
        "SELECT * FROM stripe_payments WHERE stripe_session_id = $1",
        [sessionId]
      );

      if (existingPayments.length > 0) {
        res.send({
          success: true,
          message: "Payment already processed",
          paymentId: existingPayments[0].id,
        });
        return;
      }

      // Get or create registration
      let registrationId;
      const { rows: registrations } = await db.query(
        "SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2",
        [eventId, userId]
      );

      if (registrations.length > 0) {
        registrationId = registrations[0].id;
      } else {
        const { rows: newRegistration } = await db.query(
          "INSERT INTO event_registrations (event_id, user_id, status) VALUES ($1, $2, 'registered') RETURNING id",
          [eventId, userId]
        );
        registrationId = newRegistration[0].id;
      }

      // Create a new ticket
      const ticketCode = generateUniqueCode();
      const { rows: ticket } = await db.query(
        "INSERT INTO tickets (event_id, user_id, registration_id, ticket_code, status, is_paid) VALUES ($1, $2, $3, $4, 'valid', true) RETURNING id",
        [eventId, userId, registrationId, ticketCode]
      );

      const ticketId = ticket[0].id;

      // Create payment record
      const { rows: payment } = await db.query(
        `INSERT INTO stripe_payments 
         (user_id, event_id, stripe_session_id, stripe_payment_intent_id, amount, currency, status) 
         VALUES ($1, $2, $3, $4, $5, $6, 'succeeded') 
         RETURNING id`,
        [
          userId,
          eventId,
          sessionId,
          session.payment_intent as string,
          session.amount_total ? session.amount_total / 100 : 0, // Convert from pence to pounds
          "gbp",
        ]
      );

      const paymentId = payment[0].id;

      // Update ticket with payment ID
      await db.query(
        "UPDATE tickets SET payment_id = $1, paid = true WHERE id = $2",
        [paymentId, ticketId]
      );

      res.send({
        success: true,
        ticketId,
        paymentId,
      });
      return;
    }

    res.status(400).send({
      success: false,
      message: "Payment not completed",
    });
  } catch (error) {
    console.error("Error syncing payment:", error);
    res.status(500).send({ message: (error as Error).message });
  }
};

export const handleWebhook = async (
  req: Request,
  res: Response
): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;

  // Check if Stripe is properly configured
  if (!stripeSecretKey || !process.env.STRIPE_WEBHOOK_SECRET) {
    res.status(503).send({
      message: "Stripe webhook service unavailable - API keys not configured",
      details:
        "The server administrator needs to set the STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET environment variables",
    });
    return;
  }

  let event: WebhookEvent;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || ""
    ) as WebhookEvent;
  } catch (err) {
    console.error(
      "Webhook signature verification failed:",
      (err as Error).message
    );
    res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    return;
  }

  // Handle specific events
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await processSuccessfulPayment(session);
      break;
    }
    case "payment_intent.payment_failed": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await handleFailedPayment(paymentIntent);
      break;
    }
    // Handle other event types as needed
  }

  res.send({ received: true });
};

// Helper functions
async function processSuccessfulPayment(session: Stripe.Checkout.Session) {
  const { eventId, userId } = session.metadata as {
    eventId: string;
    userId: string;
  };

  try {
    // Check if payment already processed
    const { rows: existingPayments } = await db.query(
      "SELECT * FROM stripe_payments WHERE stripe_session_id = $1",
      [session.id]
    );

    if (existingPayments.length > 0) {
      return; // Already processed
    }

    // Similar logic to syncPaymentStatus
    // This function handles webhook events which might come before the frontend redirect
    const { rows: registrations } = await db.query(
      "SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2",
      [eventId, userId]
    );

    let registrationId;
    if (registrations.length > 0) {
      registrationId = registrations[0].id;
    } else {
      const { rows: newRegistration } = await db.query(
        "INSERT INTO event_registrations (event_id, user_id, status) VALUES ($1, $2, 'registered') RETURNING id",
        [eventId, userId]
      );
      registrationId = newRegistration[0].id;
    }

    const ticketCode = generateUniqueCode();
    const { rows: ticket } = await db.query(
      "INSERT INTO tickets (event_id, user_id, registration_id, ticket_code, status, is_paid) VALUES ($1, $2, $3, $4, 'valid', true) RETURNING id",
      [eventId, userId, registrationId, ticketCode]
    );

    const ticketId = ticket[0].id;

    const { rows: payment } = await db.query(
      `INSERT INTO stripe_payments 
       (user_id, event_id, stripe_session_id, stripe_payment_intent_id, amount, currency, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'succeeded') 
       RETURNING id`,
      [
        userId,
        eventId,
        session.id,
        session.payment_intent as string,
        session.amount_total ? session.amount_total / 100 : 0,
        "gbp",
      ]
    );

    await db.query(
      "UPDATE tickets SET payment_id = $1, paid = true WHERE id = $2",
      [payment[0].id, ticketId]
    );
  } catch (error) {
    console.error("Error processing successful payment:", error);
  }
}

async function handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
  try {
    // Update payment status to failed if it exists
    await db.query(
      "UPDATE stripe_payments SET status = 'failed' WHERE stripe_payment_intent_id = $1",
      [paymentIntent.id]
    );
  } catch (error) {
    console.error("Error handling failed payment:", error);
  }
}
