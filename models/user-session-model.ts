import db from "../db/connection";
import { UserSession } from "../types";

// Create session with refresh token
export const createSession = async (
  userId: number,
  sessionToken: string,
  refreshToken: string,
  expiresAt: Date
): Promise<UserSession> => {
  const result = await db.query(
    `INSERT INTO user_sessions (user_id, session_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4)`,
    [userId, sessionToken, refreshToken, expiresAt]
  );
  return result.rows[0];
};

// Get session by refresh token
export const getSessionByRefreshToken = async (
  refreshToken: string
): Promise<UserSession> => {
  const { rows } = await db.query(
    `SELECT * FROM user_sessions WHERE refresh_token = $1`,
    [refreshToken]
  );
  return rows[0];
};

// Delete session (logout)
export const deleteSessionByRefreshToken = async (refreshToken: string) => {
  await db.query(`DELETE FROM user_sessions WHERE refresh_token = $1`, [
    refreshToken,
  ]);
};
