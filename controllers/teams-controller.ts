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
} from "../models/teams-models";

import { selectUserById, insertUser } from "../models/users-models";

export const getTeams = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const teams = await selectTeams();
    res.status(200).send({ teams });
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
  if (Object.keys(req.body).length === 0) {
    return Promise.reject({
      status: 400,
      msg: "Missing required fields",
    });
  }

  if (!name) {
    return Promise.reject({
      status: 400,
      msg: "Team name is required",
    });
  }

  try {
    const newTeam = await insertTeam(name, description);
    res.status(201).send({ newTeam });
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

  try {
    await deleteTeamById(Number(id));
    res.status(204).send();
  } catch (err) {
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
  const { user_id, team_id, role, username, email, password_hash } = req.body;

  // Two possible flows:
  // 1. Using an existing user (user_id provided)
  // 2. Creating a new user (username, email, password_hash provided)

  try {
    let userId = user_id;
    let newUser = null;

    // Check if we're creating a new user or using an existing one
    if (!user_id) {
      // Creating a new user - check for required fields
      const errors = [];

      if (!username) {
        errors.push("Username is required when creating a new user");
      }

      if (!email) {
        errors.push("Email is required when creating a new user");
      }

      if (!password_hash) {
        errors.push("Password is required when creating a new user");
      }

      if (!role) {
        errors.push("Role is required");
      }

      if (!team_id) {
        errors.push("Team ID is required");
      }

      if (errors.length > 0) {
        return res.status(400).send({
          status: "error",
          msg: errors.length === 1 ? errors[0] : "Missing required fields",
          errors,
        });
      }

      // Create the new user
      try {
        newUser = await insertUser(username, email, password_hash);
        // Access the ID from the database row (may not be defined in the User type)
        userId = (newUser as any).id;
      } catch (userCreationError) {
        return res.status(400).send({
          status: "error",
          msg: "Failed to create new user. Username or email may already be in use.",
        });
      }
    } else {
      // Using an existing user - validate role and team_id
      if (!role) {
        return res.status(400).send({
          status: "error",
          msg: "Role is required",
        });
      }

      if (!team_id) {
        return res.status(400).send({
          status: "error",
          msg: "Team ID is required",
        });
      }

      // Check if the user exists
      try {
        await selectUserById(Number(userId));
      } catch (userError) {
        return res.status(404).send({
          status: "error",
          msg: "User not found. Cannot create team member for non-existent user.",
        });
      }
    }

    // If we get here, either the user existed or we created a new one
    const newTeamMember = await insertTeamMember(
      Number(userId),
      Number(team_id),
      role
    );

    if (newUser) {
      // If we created a new user, return both the user and team member
      res.status(201).send({
        newUser,
        newTeamMember,
        msg: "User and team member created successfully",
      });
    } else {
      // If we used an existing user, just return the team member
      res.status(201).send({
        newTeamMember,
        msg: "Team member created successfully",
      });
    }
  } catch (err) {
    next(err);
  }
};
