import { Request, Response, NextFunction } from "express";
import {
  selectUsers,
  selectUserById,
  selectUserByUsername,
  selectUserByEmail,
  insertUser,
  selectStaffMembers,
  selectStaffMemberByUserId,
  insertStaffMember,
  checkUserRole,
} from "../models/users-models";

export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await selectUsers();
    res.status(200).send({ users });
  } catch (err) {
    next(err);
  }
};

export const getUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    const user = await selectUserById(Number(id));
    res.status(200).send({ user });
  } catch (err) {
    next(err);
  }
};

export const getUserByUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { username } = req.params;
  try {
    const user = await selectUserByUsername(username);
    res.status(200).send({ user });
  } catch (err) {
    next(err);
  }
};

export const getUserByEmail = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { email } = req.params;
  try {
    const user = await selectUserByEmail(email);
    res.status(200).send({ user });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { username, email, password_hash } = req.body;

  // Check for missing fields and collect all error messages
  const errors = [];

  if (!username) {
    errors.push("Username is required");
  }

  if (!email) {
    errors.push("Email is required");
  }

  if (!password_hash) {
    errors.push("Password is required");
  }

  // If any errors were found, return them all at once
  if (errors.length > 0) {
    return res.status(400).send({
      status: "error",
      msg: errors.length === 1 ? errors[0] : "Missing required fields",
      errors,
    });
  }

  try {
    const newUser = await insertUser(username, email, password_hash);
    res.status(201).send({ newUser });
  } catch (err) {
    next(err);
  }
};

// Staff Member Controller Functions

export const getStaffMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const staffMembers = await selectStaffMembers();
    res.status(200).send({ staffMembers });
  } catch (err) {
    next(err);
  }
};

export const getStaffMemberByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId } = req.params;
  try {
    const staffMember = await selectStaffMemberByUserId(Number(userId));
    if (!staffMember) {
      return res.status(404).send({
        status: "error",
        msg: "Staff member not found",
      });
    }
    res.status(200).send({ staffMember });
  } catch (err) {
    next(err);
  }
};

export const createStaffMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { user_id, role, username, email, password_hash } = req.body;

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
      // Using an existing user - validate role
      if (!role) {
        return res.status(400).send({
          status: "error",
          msg: "Role is required",
        });
      }

      // Check if the user exists
      try {
        await selectUserById(Number(userId));
      } catch (userError) {
        return res.status(404).send({
          status: "error",
          msg: "User not found. Cannot create staff member for non-existent user.",
        });
      }
    }

    // If we get here, either the user existed or we created a new one
    const newStaffMember = await insertStaffMember(Number(userId), role);

    if (newUser) {
      // If we created a new user, return both the user and staff member
      res.status(201).send({
        newUser,
        newStaffMember,
        msg: "User and staff member created successfully",
      });
    } else {
      // If we used an existing user, just return the staff member
      res.status(201).send({
        newStaffMember,
        msg: "Staff member created successfully",
      });
    }
  } catch (err) {
    next(err);
  }
};
