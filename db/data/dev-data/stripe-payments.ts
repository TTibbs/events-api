import { StripePayment } from "../../../types";

export const stripePayments: StripePayment[] = [
  {
    // Successful payment for user 1 (alice123) for event 1 (Tech Conference)
    user_id: 1,
    event_id: 1,
    stripe_session_id: "cs_test_success_123456",
    stripe_payment_intent_id: "pi_test_success_123456",
    amount: 49.99, // Matches event 1 price
    currency: "gbp",
    status: "succeeded",
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    // Failed payment for user 2 (bob123) for event 1 (Tech Conference)
    user_id: 2,
    event_id: 1,
    stripe_session_id: "cs_test_failed_123456",
    stripe_payment_intent_id: "pi_test_failed_123456",
    amount: 49.99, // Matches event 1 price
    currency: "gbp",
    status: "failed",
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    // Pending payment for user 3 (charlie123) for event 2 (JavaScript Workshop)
    user_id: 3,
    event_id: 2,
    stripe_session_id: "cs_test_pending_123456",
    stripe_payment_intent_id: "pi_test_pending_123456",
    amount: 29.99, // Matches event 2 price
    currency: "gbp",
    status: "pending",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    // Second successful payment for user 4 (siteadmin) for event 1 (Tech Conference)
    user_id: 4,
    event_id: 1,
    stripe_session_id: "cs_test_admin_success_123456",
    stripe_payment_intent_id: "pi_test_admin_success_123456",
    amount: 49.99, // Matches event 1 price
    currency: "gbp",
    status: "succeeded",
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
];
