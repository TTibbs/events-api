import { TeamMember } from "./teams";
import { Event, EventRegistration } from "./events";
import { Team } from "./teams";
import { User, UserSession } from "./users";
import { Ticket } from "./tickets";
import { StripePayment } from "./stripe";

// Authentication types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Interface for API errors with status code, message, and optional errors array
 */
export interface ApiError {
  status: number;
  msg: string;
  errors?: string[];
}

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
