import { Request, Response } from "express";
import Stripe from "stripe";
import { generateUniqueCode } from "../utils/codeGenerator";
import {
  selectUserPayments,
  updateUserStripeCustomerId,
  findRegistrationByEventAndUser,
  createRegistration,
  createTicket,
  createPaymentRecord,
  updateTicket,
  updatePaymentStatus,
  findPaymentBySessionId,
} from "../models/stripe-models";
import { CheckoutSessionData, StripeSessionInfo, WebhookEvent } from "../types";
import { selectEventById } from "../models/events-models";
import { selectUserById } from "../models/users-models";

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
    const event = await selectEventById(Number(eventId), Number(userId));

    if (!event) {
      res.status(404).send({ message: "Event not found" });
      return;
    }

    // Create or get Stripe customer for this user
    const user = await selectUserById(Number(userId));

    if (!user) {
      res.status(404).send({ message: "User not found" });
      return;
    }

    let stripeCustomerId = user.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await updateUserStripeCustomerId(userId, stripeCustomerId);
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
    // Check if this is a known error type we're handling
    if ((error as any).status === 404 && (error as any).msg) {
      res.status(404).send({ message: (error as any).msg });
    } else {
      res.status(500).send({ message: (error as Error).message });
    }
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
      const existingPayment = await findPaymentBySessionId(sessionId);

      if (existingPayment) {
        res.send({
          success: true,
          message: "Payment already processed",
          paymentId: existingPayment.id,
        });
        return;
      }

      // Get or create registration
      let registrationId;
      const registration = await findRegistrationByEventAndUser(
        eventId,
        userId
      );

      if (registration) {
        registrationId = registration.id;
      } else {
        const newRegistration = await createRegistration(eventId, userId);
        registrationId = newRegistration.id;
      }

      // Create a new ticket
      const ticketCode = generateUniqueCode();
      const ticket = await createTicket(
        eventId,
        userId,
        registrationId,
        ticketCode
      );
      const ticketId = ticket.id;

      // Create payment record
      const payment = await createPaymentRecord(
        userId,
        eventId,
        sessionId,
        session.payment_intent as string,
        session.amount_total ? session.amount_total / 100 : 0 // Convert from pence to pounds
      );

      const paymentId = payment.id;

      // Update ticket with payment ID
      await updateTicket(ticketId, paymentId);

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
    const existingPayment = await findPaymentBySessionId(session.id);

    if (existingPayment) {
      return; // Already processed
    }

    // Similar logic to syncPaymentStatus
    // This function handles webhook events which might come before the frontend redirect
    const registration = await findRegistrationByEventAndUser(eventId, userId);

    let registrationId;
    if (registration) {
      registrationId = registration.id;
    } else {
      const newRegistration = await createRegistration(eventId, userId);
      registrationId = newRegistration.id;
    }

    const ticketCode = generateUniqueCode();
    const ticket = await createTicket(
      eventId,
      userId,
      registrationId,
      ticketCode
    );
    const ticketId = ticket.id;

    const payment = await createPaymentRecord(
      userId,
      eventId,
      session.id,
      session.payment_intent as string,
      session.amount_total ? session.amount_total / 100 : 0
    );

    await updateTicket(ticketId, payment.id);
  } catch (error) {
    console.error("Error processing successful payment:", error);
  }
}

async function handleFailedPayment(paymentIntent: Stripe.PaymentIntent) {
  try {
    // Update payment status to failed if it exists
    await updatePaymentStatus(paymentIntent.id, "failed");
  } catch (error) {
    console.error("Error handling failed payment:", error);
  }
}
