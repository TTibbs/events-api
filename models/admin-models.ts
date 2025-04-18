import db from "../db/connection";

export const updateUserToAdmin = async (id: number, is_site_admin: boolean) => {
  const query = `UPDATE users SET is_site_admin = $1 WHERE id = $2 RETURNING *`;
  const result = await db.query(query, [is_site_admin, id]);
  return result.rows[0];
};
