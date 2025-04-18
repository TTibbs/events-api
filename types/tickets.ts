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

export interface TicketInfo {
  user_email: string;
  user_name: string;
  event_title: string;
  event_date: string;
  event_location: string;
  ticket_code: string;
}
