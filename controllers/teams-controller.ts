import { Request, Response, NextFunction } from "express";
import {
  selectTeams,
  selectTeamById,
  insertTeam,
  updateTeamById,
  deleteTeamById,
  selectTeamMembers,
  selectTeamMemberById,
  selectTeamMemberByUserId,
  insertTeamMember,
  selectTeamMembersByTeamId,
  selectTeamByName,
} from "../models/teams-models";

import { selectUserById, insertUser } from "../models/users-models";
import bcryptjs from "bcryptjs";
import { Team, TeamMember, User, TeamResponse } from "../types";
import { withTransaction } from "../utils/db-transaction";

export const getTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { teams, total_teams } = await selectTeams();
    res.status(200).send({ teams, total_teams });
  } catch (err) {
    next(err);
  }
};

export const getTeamById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    const team = await selectTeamById(Number(id));
    res.status(200).send({ team });
  } catch (err: any) {
    if (err.status === 404) {
      return res.status(404).json({
        status: "error",
        msg: "Team not found",
      });
    }
    next(err);
  }
};

export const getTeamByName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name } = req.params;
  try {
    const team = await selectTeamByName(name);
    if (!team) {
      return res.status(404).json({
        status: "error",
        msg: "Team not found",
      });
    }
    res.status(200).send({ team });
  } catch (err) {
    next(err);
  }
};

export const createTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name, description } = req.body;

  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  // Validation is now handled by express-validator middleware

  try {
    // Check if team name already exists
    const existingTeam = await selectTeamByName(name);
    if (existingTeam) {
      return res.status(400).json({
        status: "error",
        msg: "Team name already exists",
      });
    }

    // We already checked that req.user exists above, so we can safely use it
    const userId = req.user.id;

    const result = await withTransaction(async () => {
      // Create the team and properly type it as TeamResponse
      const newTeam = (await insertTeam(
        name,
        description
      )) as unknown as TeamResponse;

      // Add the creator as a team admin
      const newTeamMember = await insertTeamMember(
        userId,
        newTeam.id,
        "team_admin"
      );

      return { newTeam, newTeamMember };
    });

    res.status(201).json({
      status: "success",
      message: "Team created successfully and you were added as an admin",
      team: result.newTeam,
      teamMember: result.newTeamMember,
    });
  } catch (err) {
    next(err);
  }
};

export const updateTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { name, description } = req.body;

  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  // Check for missing fields
  const errors = [];

  if (!name) {
    errors.push("Team name is required");
  }

  if (errors.length > 0) {
    return res.status(400).send({
      status: "error",
      msg: errors.length === 1 ? errors[0] : "Missing required fields",
      errors,
    });
  }

  try {
    const updatedTeam = await updateTeamById(Number(id), name, description);
    res.status(200).send({ updatedTeam });
  } catch (err) {
    next(err);
  }
};

export const deleteTeam = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  // Check if user is admin of this specific team or admin of any team
  try {
    const teamMember = await selectTeamMemberByUserId(req.user.id);
    if (
      !teamMember ||
      (teamMember.team_id !== parseInt(id) &&
        teamMember.role !== "team_admin") ||
      (teamMember.team_id === parseInt(id) && teamMember.role !== "team_admin")
    ) {
      return res.status(403).json({
        status: "error",
        msg: "Forbidden - Admin privileges required",
      });
    }
  } catch (error) {
    return res.status(403).json({
      status: "error",
      msg: "Forbidden - Admin privileges required",
    });
  }

  try {
    await deleteTeamById(Number(id));
    res.status(204).send();
  } catch (err: any) {
    if (err.status === 404) {
      return res.status(404).json({
        status: "error",
        msg: "Team not found",
      });
    }
    next(err);
  }
};

// Team Member Controller Functions

export const getTeamMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teamMembers = await selectTeamMembers();
    res.status(200).send({ teamMembers });
  } catch (err) {
    next(err);
  }
};

// Get team members by team ID
export const getTeamMembersByTeamId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    // First check if the team exists
    await selectTeamById(Number(id));

    const members = await selectTeamMembersByTeamId(Number(id));
    res.status(200).send({ members });
  } catch (err) {
    next(err);
  }
};

export const getTeamMemberRoleByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId } = req.params;
  try {
    const teamMember = await selectTeamMemberByUserId(Number(userId));
    if (!teamMember) {
      return res.status(404).send({
        status: "error",
        msg: "Team member not found",
      });
    }
    res.status(200).send({ role: teamMember.role });
  } catch (err) {
    next(err);
  }
};

export const getTeamMemberById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    const teamMember = await selectTeamMemberById(Number(id));
    if (!teamMember) {
      return res.status(404).send({
        status: "error",
        msg: "Team member not found",
      });
    }
    res.status(200).send({ teamMember });
  } catch (err) {
    next(err);
  }
};

export const getTeamMemberByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId } = req.params;
  try {
    const teamMember = await selectTeamMemberByUserId(Number(userId));
    if (!teamMember) {
      return res.status(404).send({
        status: "error",
        msg: "Team member not found",
      });
    }
    res.status(200).send({ teamMember });
  } catch (err) {
    next(err);
  }
};

export const createTeamMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { user_id, team_id, role, username, email, plainPassword } = req.body;

  // Check if user is authenticated
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  // Check if user is admin of the target team or admin of any team
  try {
    const teamMember = await selectTeamMemberByUserId(req.user.id);
    if (
      !teamMember ||
      (teamMember.team_id !== parseInt(team_id) &&
        teamMember.role !== "team_admin") ||
      (teamMember.team_id === parseInt(team_id) &&
        teamMember.role !== "team_admin")
    ) {
      return res.status(403).json({
        status: "error",
        msg: "Forbidden - Admin privileges required to add team members",
      });
    }
  } catch (error) {
    return res.status(403).json({
      status: "error",
      msg: "Forbidden - Admin privileges required to add team members",
    });
  }

  // There are two main scenarios for creating a team member:
  // 1. Adding an existing user to a team (user_id provided)
  // 2. Creating a new user (username, email, plainPassword provided)

  // Validate based on which scenario we're in
  const errors = [];

  if (user_id) {
    // Scenario 1: Adding existing user to a team
    if (!team_id) {
      return res.status(400).send({
        status: "error",
        msg: "Team ID is required",
      });
    }

    if (!role) {
      return res.status(400).send({
        status: "error",
        msg: "Role is required",
      });
    }
  } else if (username || email || plainPassword) {
    // Scenario 2: Creating a new user and adding them to team
    // Ensure all required fields are present
    if (!username) {
      errors.push("Username is required when creating a new user");
    }
    if (!email) {
      errors.push("Email is required when creating a new user");
    }
    if (!plainPassword) {
      errors.push("Password is required when creating a new user");
    }
    if (!team_id) {
      errors.push("Team ID is required");
    }
    if (!role) {
      errors.push("Role is required");
    }

    if (errors.length > 0) {
      return res.status(400).send({
        status: "error",
        msg: "Missing required fields",
        errors,
      });
    }
  } else {
    // Neither scenario's requirements are met
    return res.status(400).send({
      status: "error",
      msg: "Missing required fields",
      errors: [
        "Either user_id or new user details (username, email, password) must be provided",
        "Team ID is required",
        "Role is required",
      ],
    });
  }

  try {
    let userId = user_id;
    let newUser: User | null = null;

    // If user_id is not provided, create a new user
    if (!userId) {
      // Hash the password
      const saltRounds = 10;
      const password_hash = await bcryptjs.hash(plainPassword, saltRounds);

      // Create the user
      try {
        newUser = await insertUser(username, email, password_hash);
        userId = (newUser as any).id; // Cast to any to access the ID property
      } catch (error) {
        return res.status(400).send({
          status: "error",
          msg: "Failed to create new user. Username or email may already be in use.",
        });
      }
    } else {
      // Verify the user exists
      try {
        await selectUserById(userId);
      } catch (error) {
        return res.status(404).send({
          status: "error",
          msg: "User not found. Cannot create team member for non-existent user.",
        });
      }
    }

    // Create the team member
    const teamMember = await insertTeamMember(userId, team_id, role);

    // Return appropriate response based on whether we created a new user
    if (newUser) {
      res.status(201).send({
        status: "success",
        msg: "User and team member created successfully",
        newUser,
        newTeamMember: teamMember,
      });
    } else {
      res.status(201).send({
        status: "success",
        msg: "Team member created successfully",
        newTeamMember: teamMember,
      });
    }
  } catch (err) {
    next(err);
  }
};
