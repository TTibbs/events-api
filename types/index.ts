export type User = {
  id?: number;
  username: string;
  email: string;
  password_hash: string;
  profile_image_url: string;
  is_site_admin: boolean;
  created_at: Date;
  updated_at: Date;
  teams?: TeamInfo[];
};

export type UserSession = {
  user_id: number;
  session_token: string;
  refresh_token: string;
  created_at: Date;
  expires_at: Date;
};

export type Team = {
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
};

export type TeamMember = {
  user_id: number;
  team_id: number;
  role: string;
  created_at: Date;
};

// Extended TeamMember to include ID which is returned from our team model
export interface ExtendedTeamMember extends TeamMember {
  id: number;
}

export type Event = {
  status: string;
  title: string;
  team_id: number;
  description: string;
  location: string;
  start_time: Date;
  end_time: Date;
  max_attendees: number;
  price: number;
  event_type: string;
  is_public: boolean;
  created_by: number;
  created_at: Date;
  updated_at: Date;
};

export type EventRegistration = {
  event_id: number;
  user_id: number;
  registration_time: Date;
  status: string;
};

export type Ticket = {
  event_id: number;
  user_id: number;
  registration_id: number;
  paid?: boolean;
  ticket_code: string;
  issued_at: Date;
  used_at: Date | null;
  status: string;
  created_at?: Date;
  updated_at?: Date;
};

export type TeamInfo = {
  team_id: number;
  team_name: string;
  team_description: string;
  role: string;
};

// Extended API response interfaces
export interface TicketResponse extends Ticket {
  id: number; // Ensure id is required in response
}

export interface TicketWithEventInfo extends TicketResponse {
  event_title: string;
  start_time: string;
  end_time: string;
  location: string;
}

export interface TicketWithUserInfo extends TicketResponse {
  username: string;
  email: string;
}

// Add Event API response interfaces
export interface EventResponse extends Event {
  id: number;
}

export interface EventRegistrationResponse extends EventRegistration {
  id: number;
  username?: string;
  email?: string;
  event_title?: string;
  reactivated?: boolean;
}

// User Updates type for updating user information
export interface UserUpdates {
  username?: string;
  email?: string;
  password_hash?: string;
  is_site_admin?: boolean;
}

// Event Updates
export interface EventUpdateData {
  status?: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  start_time?: Date;
  end_time?: Date;
  max_attendees?: number | null;
  price?: number | null;
  event_type?: string | null;
  is_public?: boolean;
  team_id?: number;
  created_by?: number | null;
}

// Email related types
export interface EmailInfo {
  to: string;
  name: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  ticketCode: string;
}

export interface TicketInfo {
  user_email: string;
  user_name: string;
  event_title: string;
  event_date: string;
  event_location: string;
  ticket_code: string;
}

// Extended EventRegistration with ticket info
export interface ExtendedEventRegistration extends EventRegistrationResponse {
  ticket_info?: TicketInfo;
  reactivated?: boolean;
}

export interface EventAvailabilityResponse {
  available: boolean;
  reason?: string;
}

export interface TeamResponse extends Team {
  id: number;
}

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegistrationData {
  username: string;
  email: string;
  password: string;
  isEventOrganiser?: boolean;
  teamName?: string;
  teamDescription?: string;
}

// Admin Dashboard types
export interface AdminDashboardData {
  users: User[];
  total_users: number;
  events: EventResponse[];
  total_events: number;
  draft_events: EventResponse[];
  teams: TeamResponse[];
  total_teams: number;
  tickets: TicketResponse[];
  registrations: EventRegistrationResponse[];
}

// Stripe related types
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

export interface SeedData {
  users: User[];
  events: Event[];
  eventRegistrations: EventRegistration[];
  teams: Team[];
  teamMembers: TeamMember[];
  userSessions: UserSession[];
  tickets: Ticket[];
  stripePayments?: StripePayment[];
}
