import db from "../db/connection";
import { Team, TeamMember, User, ExtendedTeamMember } from "../types";

export const selectTeams = async (): Promise<{
  teams: Team[];
  total_teams: number;
}> => {
  const result = await db.query("SELECT * FROM teams");

  // Get total count of teams
  const countResult = await db.query(
    "SELECT COUNT(*) as total_teams FROM teams"
  );

  if (result.rows.length === 0) {
    return Promise.reject({ status: 404, msg: "No teams found" });
  }

  return {
    teams: result.rows.map((team) => ({
      ...team,
      id: Number(team.id),
    })) as Team[],
    total_teams: parseInt(countResult.rows[0].total_teams),
  };
};

export const selectTeamById = async (id: number): Promise<Team> => {
  const { rows } = await db.query("SELECT * FROM teams WHERE id = $1", [id]);
  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "Team not found" });
  }

  const team = {
    ...rows[0],
    id: Number(rows[0].id),
  };

  return team as Team;
};

export const selectTeamByName = async (name: string): Promise<Team | null> => {
  const { rows } = await db.query("SELECT * FROM teams WHERE name = $1", [
    name,
  ]);
  if (rows.length === 0) return null;
  return rows[0] as Team;
};

export const insertTeam = async (
  name: string,
  description?: string
): Promise<Team> => {
  const { rows } = await db.query(
    "INSERT INTO teams (name, description) VALUES ($1, $2) RETURNING *",
    [name, description || null]
  );

  const team = {
    ...rows[0],
    id: Number(rows[0].id),
  };

  return team as Team;
};

export const updateTeamById = async (
  id: number,
  name: string,
  description?: string
): Promise<Team> => {
  const { rows } = await db.query(
    "UPDATE teams SET name = $1, description = $2 WHERE id = $3 RETURNING *",
    [name, description || null, id]
  );

  if (rows.length === 0) {
    return Promise.reject({ status: 404, msg: "Team not found" });
  }

  const team = {
    ...rows[0],
    id: Number(rows[0].id),
  };

  return team as Team;
};

export const deleteTeamById = async (id: number): Promise<void> => {
  const { rowCount } = await db.query("DELETE FROM teams WHERE id = $1", [id]);

  if (rowCount === 0) {
    return Promise.reject({ status: 404, msg: "Team not found" });
  }
};

// Team Member Functions

export const selectTeamMembers = async (): Promise<{
  teamMembers: (User & TeamMember)[];
  total_team_members: number;
}> => {
  // Define the queries
  const teamMembersQuery = `
    SELECT users.*, 
           team_members.id, 
           team_members.user_id, 
           team_members.team_id,
           team_members.role, 
           team_members.created_at as team_created_at
    FROM team_members
    JOIN users ON users.id = team_members.user_id
  `;

  const countQuery = `
    SELECT COUNT(*) as total_team_members 
    FROM team_members
  `;

  // Execute both queries in parallel
  const [teamMembersResult, countResult] = await Promise.all([
    db.query(teamMembersQuery),
    db.query(countQuery),
  ]);

  // Parse numeric fields as numbers to ensure consistency
  const teamMembers = teamMembersResult.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    user_id: Number(row.user_id),
    team_id: Number(row.team_id),
  }));

  return {
    teamMembers: teamMembers as (User & TeamMember)[],
    total_team_members: parseInt(countResult.rows[0].total_team_members),
  };
};

export const selectTeamMemberByUserId = async (
  userId: number
): Promise<(User & TeamMember) | null> => {
  const { rows } = await db.query(
    `SELECT users.*, 
            team_members.id, 
            team_members.user_id, 
            team_members.team_id,
            team_members.role, 
            team_members.created_at as team_created_at
     FROM team_members
     JOIN users ON users.id = team_members.user_id
     WHERE users.id = $1`,
    [userId]
  );

  if (rows.length === 0) return null;

  // Parse numeric fields as numbers to ensure consistency
  const teamMember = {
    ...rows[0],
    id: Number(rows[0].id),
    user_id: Number(rows[0].user_id),
    team_id: Number(rows[0].team_id),
  };

  return teamMember as User & TeamMember;
};

export const selectTeamMemberById = async (
  teamMemberId: number
): Promise<(User & TeamMember) | null> => {
  const { rows } = await db.query(
    `SELECT users.*, 
            team_members.id, 
            team_members.user_id, 
            team_members.team_id,
            team_members.role, 
            team_members.created_at as team_created_at
     FROM team_members
     JOIN users ON users.id = team_members.user_id
     WHERE team_members.id = $1`,
    [teamMemberId]
  );

  if (rows.length === 0) return null;

  // Parse numeric fields as numbers to ensure consistency
  const teamMember = {
    ...rows[0],
    id: Number(rows[0].id),
    user_id: Number(rows[0].user_id),
    team_id: Number(rows[0].team_id),
  };

  return teamMember as User & TeamMember;
};

export const insertTeamMember = async (
  userId: number,
  teamId: number,
  role: string
): Promise<ExtendedTeamMember> => {
  const { rows } = await db.query(
    "INSERT INTO team_members (user_id, team_id, role) VALUES ($1, $2, $3) RETURNING *",
    [userId, teamId, role]
  );

  // Parse numeric fields to ensure consistent types
  const teamMember = {
    ...rows[0],
    id: Number(rows[0].id),
    user_id: Number(rows[0].user_id),
    team_id: Number(rows[0].team_id),
  };

  return teamMember as ExtendedTeamMember;
};

export const checkUserRole = async (
  userId: number,
  requiredRole: string
): Promise<boolean> => {
  const teamMember = await selectTeamMemberByUserId(userId);
  if (!teamMember) return false;

  // If requiredRole is 'admin' or 'team_admin', only team_admins can access
  if (requiredRole === "admin" || requiredRole === "team_admin") {
    return teamMember.role === "team_admin";
  }

  // If requiredRole is 'event_manager', both team_admins and event_managers can access
  if (requiredRole === "event_manager") {
    return ["team_admin", "event_manager"].includes(teamMember.role);
  }

  // Return true for any other role matching exactly
  return teamMember.role === requiredRole;
};

// Get team members by team ID
export const selectTeamMembersByTeamId = async (
  teamId: number
): Promise<{
  members: (User & TeamMember)[];
  total_members: number;
}> => {
  const teamMembersQuery = `
    SELECT users.*, 
            team_members.id, 
            team_members.user_id, 
            team_members.team_id,
            team_members.role, 
            team_members.created_at as team_created_at
     FROM team_members
     JOIN users ON users.id = team_members.user_id
     WHERE team_members.team_id = $1
  `;

  const countQuery = `
    SELECT COUNT(*) as total_members 
    FROM team_members
    WHERE team_id = $1
  `;

  // Execute both queries in parallel
  const [teamMembersResult, countResult] = await Promise.all([
    db.query(teamMembersQuery, [teamId]),
    db.query(countQuery, [teamId]),
  ]);

  // Parse numeric fields as numbers to ensure consistency
  const members = teamMembersResult.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    user_id: Number(row.user_id),
    team_id: Number(row.team_id),
  }));

  return {
    members: members as (User & TeamMember)[],
    total_members: parseInt(countResult.rows[0].total_members),
  };
};
