import { Request, Response, NextFunction } from "express";
import {
  selectUsers,
  selectUserById,
  selectUserByUsername,
  selectUserByEmail,
  insertUser,
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
