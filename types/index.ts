export type User = {
  id?: number;
  username: string;
  email: string;
  password_hash: string;
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
  // Optional relation fields that might be included in responses
  username?: string;
  email?: string;
  event_title?: string;
  reactivated?: boolean;
}

export interface EventAvailabilityResponse {
  available: boolean;
  reason?: string;
}

export interface SeedData {
  users: User[];
  events: Event[];
  eventRegistrations: EventRegistration[];
  teams: Team[];
  teamMembers: TeamMember[];
  userSessions: UserSession[];
  tickets: Ticket[];
}
