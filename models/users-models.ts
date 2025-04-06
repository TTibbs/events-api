import db from "../db/connection";
import { User } from "../types";

export const selectUsers = async (): Promise<User[]> => {
  const result = await db.query("SELECT * FROM users");
  if (result.rows.length === 0) {
    return Promise.reject({ status: 404, msg: "No users found" });
  }
  return result.rows as User[];
};

export const selectUserByUsername = async (
  username: string
): Promise<User | null> => {
  const { rows } = await db.query("SELECT * FROM users WHERE username = $1", [
    username,
  ]);
  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }
  return rows[0] as User;
};

export const selectUserByEmail = async (
  email: string
): Promise<User | null> => {
  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }
  return rows[0] as User;
};

export const selectUserById = async (id: number): Promise<User | null> => {
  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }
  return rows[0] as User;
};

export const insertUser = async (
  username: string,
  email: string,
  password_hash: string
): Promise<User> => {
  const { rows } = await db.query(
    "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
    [username, email, password_hash]
  );
  return rows[0];
};

export const updateUser = async (
  id: number,
  updates: Partial<User>
): Promise<User> => {
  // Build query based on provided fields
  const fields: string[] = [];
  const values: any[] = [];
  let queryIndex = 1;

  // Add fields that are present in updates
  if (updates.username) {
    fields.push(`username = $${queryIndex++}`);
    values.push(updates.username);
  }

  if (updates.email) {
    fields.push(`email = $${queryIndex++}`);
    values.push(updates.email);
  }

  if (updates.password_hash) {
    fields.push(`password_hash = $${queryIndex++}`);
    values.push(updates.password_hash);
  }

  // If no fields to update, reject
  if (fields.length === 0) {
    return Promise.reject({
      status: 400,
      msg: "No valid fields to update",
    });
  }

  // Add ID as the last parameter
  values.push(id);

  const query = `
    UPDATE users 
    SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${queryIndex}
    RETURNING *
  `;

  const { rows } = await db.query(query, values);

  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }

  return rows[0] as User;
};

export const deleteUser = async (id: number): Promise<void> => {
  const { rowCount } = await db.query("DELETE FROM users WHERE id = $1", [id]);

  if (rowCount === 0) {
    return Promise.reject({ status: 404, msg: "User not found" });
  }
};
