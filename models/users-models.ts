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
