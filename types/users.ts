import { TeamInfo } from "./teams";

export type User = {
  id?: number;
  username: string;
  email: string;
  password_hash: string;
  profile_image_url: string;
  stripe_customer_id: string | null;
  is_site_admin: boolean;
  created_at: Date;
  updated_at: Date;
  teams?: TeamInfo[];
};

// Test User Types
export type TestUserRole = "team_admin" | "event_manager" | "team_member";
export interface TestUser {
  id: number;
  username: string;
  email: string;
  teamId?: number;
  role?: TestUserRole;
}

export type UserSession = {
  user_id: number;
  session_token: string;
  refresh_token: string;
  created_at: Date;
  expires_at: Date;
};

// User Updates type for updating user information
export interface UserUpdates {
  username?: string;
  email?: string;
  password_hash?: string;
  is_site_admin?: boolean;
  profile_image_url?: string;
}

export interface RegistrationData {
  username: string;
  email: string;
  password: string;
  isEventOrganiser?: boolean;
  teamName?: string;
  teamDescription?: string;
}
