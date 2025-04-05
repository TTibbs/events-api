import db from "../db/connection";
import { User, StaffMember } from "../types";

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

// Staff Member Functions

export const selectStaffMembers = async (): Promise<(User & StaffMember)[]> => {
  const { rows } = await db.query(
    `SELECT users.*, 
            staff_members.id, 
            staff_members.user_id, 
            staff_members.role, 
            staff_members.created_at as staff_created_at
     FROM staff_members
     JOIN users ON users.id = staff_members.user_id`
  );

  // Return empty array instead of rejecting when no staff members exist
  // This is different from other select functions to support the use case
  // where having no staff members is a valid state

  // Parse user_id as number to ensure consistency
  const staffMembers = rows.map((row) => ({
    ...row,
    id: Number(row.id),
    user_id: Number(row.user_id),
  }));

  return staffMembers as (User & StaffMember)[];
};

export const selectStaffMemberByUserId = async (
  userId: number
): Promise<(User & StaffMember) | null> => {
  const { rows } = await db.query(
    `SELECT users.*, 
            staff_members.id, 
            staff_members.user_id, 
            staff_members.role, 
            staff_members.created_at as staff_created_at
     FROM staff_members
     JOIN users ON users.id = staff_members.user_id
     WHERE users.id = $1`,
    [userId]
  );

  if (rows.length === 0) return null;

  // Parse user_id as number to ensure consistency
  const staffMember = {
    ...rows[0],
    id: Number(rows[0].id),
    user_id: Number(rows[0].user_id),
  };

  return staffMember as User & StaffMember;
};

export const insertStaffMember = async (
  userId: number,
  role: string
): Promise<StaffMember> => {
  const { rows } = await db.query(
    "INSERT INTO staff_members (user_id, role) VALUES ($1, $2) RETURNING *",
    [userId, role]
  );

  // Parse numeric fields to ensure consistent types
  const staffMember = {
    ...rows[0],
    id: Number(rows[0].id),
    user_id: Number(rows[0].user_id),
  };

  return staffMember as StaffMember;
};

export const checkUserRole = async (
  userId: number,
  requiredRole: string
): Promise<boolean> => {
  const staffMember = await selectStaffMemberByUserId(userId);
  if (!staffMember) return false;

  // If requiredRole is 'admin', only admins can access
  if (requiredRole === "admin") {
    return staffMember.role === "admin";
  }

  // If requiredRole is 'event_manager', both admins and event_managers can access
  if (requiredRole === "event_manager") {
    return ["admin", "event_manager"].includes(staffMember.role);
  }

  return false;
};
