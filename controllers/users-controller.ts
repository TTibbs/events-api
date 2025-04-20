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
  selectUserEventRegistrations,
} from "../models/users-models";
import { sanitizeUser, sanitizeUsers } from "../utils/databaseHelpers";
import { User, EventRegistrationResponse, UserUpdates } from "../types";

export const checkIsUserSiteAdmin = async (
  userId: number
): Promise<boolean> => {
  const user = await selectUserById(userId);
  return !!user?.is_site_admin;
};

export const getUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { users, total_users } = await selectUsers();
    const sanitizedUsers = sanitizeUsers(users);
    res.status(200).send({ users: sanitizedUsers, total_users });
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
    if (isNaN(Number(id))) {
      return res.status(400).send({ msg: "Invalid user ID" });
    }
    const user = await selectUserById(Number(id));
    const sanitizedUser = sanitizeUser(user as User);
    res.status(200).send({ user: sanitizedUser });
  } catch (err) {
    next(err);
  }
};

export const getIsUserSiteAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    const is_site_admin = await checkIsUserSiteAdmin(Number(id));
    res.status(200).send({ is_site_admin });
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
    const sanitizedUser = sanitizeUser(user as User);
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
    const sanitizedUser = sanitizeUser(user as User);
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
  const { username, email, plainPassword, profile_image_url } = req.body;

  const errors: string[] = [];
  if (!username) {
    errors.push("Username is required");
  }
  if (!email) {
    errors.push("Email is required");
  }
  if (!plainPassword) {
    errors.push("Password is required");
  }
  if (errors.length > 0) {
    return res.status(400).send({
      status: "error",
      msg: errors.length === 1 ? errors[0] : "Missing required fields",
      errors,
    });
  }

  try {
    const saltRounds = 10;
    const password_hash = await bcryptjs.hash(plainPassword, saltRounds);
    const newUser = await insertUser(
      username,
      email,
      password_hash,
      profile_image_url
    );
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
  const { username, email, plainPassword, profile_image_url } = req.body;

  // Create updates object first to simplify empty check
  const updates: UserUpdates = {};
  if (username) updates.username = username;
  if (email) updates.email = email;
  if (profile_image_url) updates.profile_image_url = profile_image_url;

  // Check if we have anything to update (including password)
  const hasUpdates = Object.keys(updates).length > 0 || plainPassword;
  if (!hasUpdates) {
    return res.status(400).send({
      status: "error",
      msg: "No valid fields to update",
    });
  }

  try {
    const existingUser = await selectUserById(Number(id));
    if (username && username !== existingUser!.username) {
      // If selectUserByUsername returns successfully, that username exists
      // If it throws a 404, that means the username is available (good)
      let usernameAvailable = false;
      try {
        const userWithUsername = await selectUserByUsername(username);
        // Username exists, but check if it's for a different user
        if (userWithUsername && userWithUsername.id !== Number(id)) {
          return res.status(409).send({
            status: "error",
            msg: "Username already exists",
          });
        }
      } catch (error: any) {
        // If error is 404, username doesn't exist which means it's available
        if (error.status === 404) {
          usernameAvailable = true;
        } else {
          return next(error);
        }
      }
    }

    // Check email uniqueness if changing email
    if (email && email !== existingUser!.email) {
      // If selectUserByEmail returns successfully, that email exists
      // If it throws a 404, that means the email is available (good)
      let emailAvailable = false;
      try {
        const userWithEmail = await selectUserByEmail(email);
        // Email exists, but check if it's for a different user
        if (userWithEmail && userWithEmail.id !== Number(id)) {
          return res.status(409).send({
            status: "error",
            msg: "Email already exists",
          });
        }
      } catch (error: any) {
        // If error is 404, email doesn't exist which means it's available
        if (error.status === 404) {
          emailAvailable = true;
        } else {
          return next(error);
        }
      }
    }

    if (plainPassword) {
      const saltRounds = 10;
      updates.password_hash = await bcryptjs.hash(plainPassword, saltRounds);
    }
    const updatedUser = await updateUser(Number(id), updates);
    const sanitizedUser = sanitizeUser(updatedUser as User);

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

export const getUserEventRegistrations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  try {
    await selectUserById(Number(id));
    const registrations: EventRegistrationResponse[] =
      await selectUserEventRegistrations(Number(id));

    res.status(200).send({
      status: "success",
      registrations,
    });
  } catch (err) {
    next(err);
  }
};
