export interface CheckoutSessionData {
  eventId: number | string;
  userId: number | string;
}

export interface StripeSessionInfo {
  url: string;
  sessionId: string;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: any;
  };
}

export type StripePayment = {
  user_id: number;
  event_id: number;
  stripe_session_id: string;
  stripe_payment_intent_id: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed";
  created_at?: Date;
  updated_at?: Date;
};
