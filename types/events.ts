import { TicketInfo } from "./tickets";

export type Event = {
  status: string;
  title: string;
  team_id: number;
  event_img_url: string | null; // Can be URL or file path
  description: string;
  location: string;
  start_time: Date;
  end_time: Date;
  max_attendees: number;
  tickets_remaining: number;
  price: number;
  category: string;
  is_public: boolean;
  is_past: boolean;
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

// Add Event API response interfaces
export interface EventResponse extends Event {
  id: number;
  price: number;
  team_name?: string;
}

export interface EventRegistrationResponse extends EventRegistration {
  id: number;
  username?: string;
  email?: string;
  event_title?: string;
  reactivated?: boolean;
  registration?: RegistrationObject;
}

export interface EventRegistrationError extends EventRegistration {
  msg: string;
}

export interface RegistrationObject {
  id: number;
  event_id: number;
  user_id: number;
  registration_time: Date;
  status: string;
  ticket_info?: TicketInfo;
}

// Event Updates
export interface EventUpdateData {
  status?: string;
  title?: string;
  description?: string | null;
  event_img_url?: string | null; // Can be URL or file path
  location?: string | null;
  start_time?: Date;
  end_time?: Date;
  max_attendees?: number | null;
  price?: number | null;
  category?: string | null;
  is_public?: boolean;
  team_id?: number;
  created_by?: number | null;
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

export interface Category {
  name: string;
}

export interface EventsQueryOptions {
  sort_by?: string;
  order?: string;
  category?: string;
  limit?: number;
  page?: number;
}

export interface EventsResponse {
  events: Event[];
  total_events: number;
  total_pages: number;
}
