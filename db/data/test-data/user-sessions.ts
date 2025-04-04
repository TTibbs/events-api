import { UserSession } from "../../../types";

export const userSessions: UserSession[] = [
  {
    user_id: 1,
    session_token: "session_token_1",
    refresh_token: "refresh_token_1",
    created_at: new Date(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
  },
  {
    user_id: 2,
    session_token: "session_token_2",
    refresh_token: "refresh_token_2",
    created_at: new Date(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24),
  },
];
