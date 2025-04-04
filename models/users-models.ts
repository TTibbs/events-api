import db from "../db/connection";
import { User } from "../types";

export const selectUsers = async (): Promise<User[]> => {
  const result = await db.query("SELECT * FROM users");
  return result.rows as User[];
};

export const getUserByUsername = async (
  username: string
): Promise<User | null> => {
  const { rows } = await db.query("SELECT * FROM users WHERE username = $1", [
    username,
  ]);
  return rows[0] || null;
};

export const getUserByEmail = async (email: string): Promise<User | null> => {
  const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return rows[0] || null;
};

export const getUserById = async (id: number): Promise<User | null> => {
  const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  return rows[0] || null;
};

export const createUser = async (
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
