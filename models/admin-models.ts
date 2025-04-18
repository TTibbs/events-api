import db from "../db/connection";
import { EventResponse, User } from "../types";

export const updateUserToAdmin = async (
  id: number,
  is_site_admin: boolean
): Promise<User> => {
  const query = `UPDATE users SET is_site_admin = $1 WHERE id = $2 RETURNING *`;
  const result = await db.query(query, [is_site_admin, id]);
  return result.rows[0] as User;
};

export const getDraftEvents = async (): Promise<EventResponse[]> => {
  const result = await db.query(`SELECT 
          e.*,
          t.name as team_name,
          tm.username as creator_username
        FROM events e
        LEFT JOIN teams t ON e.team_id = t.id
        LEFT JOIN team_members tm_link ON e.created_by = tm_link.id
        LEFT JOIN users tm ON tm_link.user_id = tm.id
        WHERE e.status = 'draft'
        ORDER BY e.start_time ASC`);

  return result.rows.map((event) => ({
    ...event,
    id: Number(event.id),
    team_id: event.team_id ? Number(event.team_id) : null,
    created_by: event.created_by ? Number(event.created_by) : null,
    price: event.price ? Number(event.price) : null,
    max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
  })) as EventResponse[];
};
