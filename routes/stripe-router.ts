import express, { Router, RequestHandler } from "express";
import {
  createCheckoutSession,
  syncPaymentStatus,
  handleWebhook,
} from "../controllers/stripe-controller";
import { authenticate } from "../middlewares/auth-middleware";

const router = Router();

// Cast controller functions to RequestHandler with unknown intermediary
const createCheckoutSessionHandler =
  createCheckoutSession as unknown as RequestHandler;
const syncPaymentStatusHandler = syncPaymentStatus as unknown as RequestHandler;
const handleWebhookHandler = handleWebhook as unknown as RequestHandler;
const authenticateHandler = authenticate as RequestHandler;

// Route for creating a new checkout session
router.post(
  "/create-checkout-session",
  authenticateHandler,
  createCheckoutSessionHandler
);

// Route for syncing payment status after successful payment
router.post(
  "/sync-payment/:sessionId",
  authenticateHandler,
  syncPaymentStatusHandler
);

// Webhook route (no authentication as it's called by Stripe)
// Raw body is handled at the app level
router.post("/webhook", handleWebhookHandler);

export default router;
