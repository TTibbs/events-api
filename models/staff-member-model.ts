import db from "../db/connection";
import { StaffMember } from "../types";

export const getStaffMemberByUserId = async (
  userId: number
): Promise<StaffMember | null> => {
  const { rows } = await db.query(
    "SELECT * FROM staff_members WHERE user_id = $1",
    [userId]
  );
  return rows[0] || null;
};

export const createStaffMember = async (
  userId: number,
  role: string
): Promise<StaffMember> => {
  const { rows } = await db.query(
    "INSERT INTO staff_members (user_id, role) VALUES ($1, $2) RETURNING *",
    [userId, role]
  );
  return rows[0];
};

export const hasRole = async (
  userId: number,
  requiredRole: string
): Promise<boolean> => {
  const staffMember = await getStaffMemberByUserId(userId);
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
