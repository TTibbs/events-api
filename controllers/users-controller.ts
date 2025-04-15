import { Request, Response, NextFunction } from "express";
import bcryptjs from "bcryptjs";
import {
  selectUsers,
  selectUserById,
  selectUserByUsername,
  selectUserByEmail,
  insertUser,
  updateUser,
  deleteUser,
} from "../models/users-models";

// Helper function to sanitize user objects (remove password_hash)
const sanitizeUser = (user: any) => {
  if (!user) return user;

  const { password_hash, ...sanitizedUser } = user;
  return sanitizedUser;
};

// Helper function to sanitize an array of users
const sanitizeUsers = (users: any[]) => {
  return users.map((user) => sanitizeUser(user));
};

export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await selectUsers();
    // Sanitize all users
    const sanitizedUsers = sanitizeUsers(users);
    res.status(200).send({ users: sanitizedUsers });
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
    // Sanitize user
    const sanitizedUser = sanitizeUser(user);
    res.status(200).send({ user: sanitizedUser });
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
    // Sanitize user
    const sanitizedUser = sanitizeUser(user);
    res.status(200).send({ user: sanitizedUser });
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
    // Sanitize user
    const sanitizedUser = sanitizeUser(user);
    res.status(200).send({ user: sanitizedUser });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { username, email, plainPassword } = req.body;

  // Check for missing fields and collect all error messages
  const errors = [];

  if (!username) {
    errors.push("Username is required");
  }

  if (!email) {
    errors.push("Email is required");
  }

  if (!plainPassword) {
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
    // Hash the password before storing it
    const saltRounds = 10;
    const password_hash = await bcryptjs.hash(plainPassword, saltRounds);

    const newUser = await insertUser(username, email, password_hash);
    // Sanitize user
    const sanitizedUser = sanitizeUser(newUser);
    res.status(201).send({ newUser: sanitizedUser });
  } catch (err) {
    next(err);
  }
};

export const updateUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { username, email, plainPassword } = req.body;

  // Don't allow empty update
  if (!username && !email && !plainPassword) {
    return res.status(400).send({
      status: "error",
      msg: "No valid fields to update",
    });
  }

  try {
    // First check if the user exists
    const existingUser = await selectUserById(Number(id));

    // We know existingUser is not null at this point because selectUserById
    // would have thrown an error if the user didn't exist

    // Check if username already exists (if username is being updated)
    if (username && username !== existingUser!.username) {
      try {
        const userWithUsername = await selectUserByUsername(username);
        // If we get here, a user with this username exists
        return res.status(409).send({
          status: "error",
          msg: "Username already exists",
        });
      } catch (error: any) {
        // If error is 404, username doesn't exist - that's good
        if (error.status !== 404) {
          return next(error);
        }
      }
    }

    // Check if email already exists (if email is being updated)
    if (email && email !== existingUser!.email) {
      try {
        const userWithEmail = await selectUserByEmail(email);
        // If we get here, a user with this email exists
        return res.status(409).send({
          status: "error",
          msg: "Email already exists",
        });
      } catch (error: any) {
        // If error is 404, email doesn't exist - that's good
        if (error.status !== 404) {
          return next(error);
        }
      }
    }

    // Prepare updates object
    const updates: any = {};
    if (username) updates.username = username;
    if (email) updates.email = email;

    // Hash password if provided
    if (plainPassword) {
      const saltRounds = 10;
      updates.password_hash = await bcryptjs.hash(plainPassword, saltRounds);
    }

    // Proceed with the update
    const updatedUser = await updateUser(Number(id), updates);

    // Sanitize user
    const sanitizedUser = sanitizeUser(updatedUser);

    res.status(200).send({
      status: "success",
      msg: "User updated successfully",
      user: sanitizedUser,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  try {
    await deleteUser(Number(id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
