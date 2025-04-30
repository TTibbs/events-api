import db from "../db/connection";
import { StripePayment } from "../types";

export const selectUserPayments = async (
  userId: string
): Promise<StripePayment[]> => {
  const { rows } = await db.query(
    "SELECT * FROM stripe_payments WHERE user_id = $1",
    [userId]
  );
  if (rows.length === 0) {
    return Promise.reject({ status: 404, message: "No payments found" });
  }
  return rows as StripePayment[];
};

export const updateUserStripeCustomerId = async (
  userId: string | number,
  stripeCustomerId: string
): Promise<void> => {
  await db.query("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [
    stripeCustomerId,
    userId,
  ]);
};

export const findRegistrationByEventAndUser = async (
  eventId: string | number,
  userId: string | number
) => {
  const { rows } = await db.query(
    "SELECT id FROM event_registrations WHERE event_id = $1 AND user_id = $2",
    [eventId, userId]
  );
  return rows.length > 0 ? rows[0] : null;
};

export const createRegistration = async (
  eventId: string | number,
  userId: string | number
) => {
  const { rows } = await db.query(
    "INSERT INTO event_registrations (event_id, user_id, status) VALUES ($1, $2, 'registered') RETURNING id",
    [eventId, userId]
  );
  return rows[0];
};

export const createTicket = async (
  eventId: string | number,
  userId: string | number,
  registrationId: number,
  ticketCode: string
) => {
  const { rows } = await db.query(
    "INSERT INTO tickets (event_id, user_id, registration_id, ticket_code, status, paid) VALUES ($1, $2, $3, $4, 'valid', true) RETURNING id",
    [eventId, userId, registrationId, ticketCode]
  );
  return rows[0];
};

export const createPaymentRecord = async (
  userId: string | number,
  eventId: string | number,
  sessionId: string,
  paymentIntentId: string,
  amount: number,
  currency: string = "gbp"
) => {
  const { rows } = await db.query(
    `INSERT INTO stripe_payments 
     (user_id, event_id, stripe_session_id, stripe_payment_intent_id, amount, currency, status) 
     VALUES ($1, $2, $3, $4, $5, $6, 'succeeded') 
     RETURNING id`,
    [userId, eventId, sessionId, paymentIntentId, amount, currency]
  );
  return rows[0];
};

export const updateTicket = async (ticketId: number, paymentId: number) => {
  await db.query(
    "UPDATE tickets SET payment_id = $1, paid = true WHERE id = $2",
    [paymentId, ticketId]
  );
};

export const updatePaymentStatus = async (
  paymentIntentId: string,
  status: string
) => {
  await db.query(
    "UPDATE stripe_payments SET status = $1 WHERE stripe_payment_intent_id = $2",
    [status, paymentIntentId]
  );
};

export const findPaymentBySessionId = async (sessionId: string) => {
  const { rows } = await db.query(
    "SELECT * FROM stripe_payments WHERE stripe_session_id = $1",
    [sessionId]
  );
  return rows.length > 0 ? rows[0] : null;
};

export const decrementTicketsRemaining = async (
  eventId: string | number
): Promise<void> => {
  await db.query(
    `UPDATE events 
     SET tickets_remaining = CASE 
       WHEN tickets_remaining IS NULL THEN NULL
       WHEN tickets_remaining > 0 THEN tickets_remaining - 1
       ELSE 0
     END
     WHERE id = $1 AND tickets_remaining IS NOT NULL`,
    [eventId]
  );
};
