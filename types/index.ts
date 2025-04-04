export type User = {
  username: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
};

export type UserSession = {
  user_id: number;
  session_token: string;
  refresh_token: string;
  created_at: Date;
  expires_at: Date;
};

export type StaffMember = {
  user_id: number;
  role: string;
  created_at: Date;
};

export type Event = {
  status: string;
  title: string;
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

export interface SeedData {
  userData: User[];
  eventData: Event[];
  eventRegistrationData: EventRegistration[];
  staffMemberData: StaffMember[];
  userSessionData: UserSession[];
}
