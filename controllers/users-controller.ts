import { Request, Response, NextFunction } from "express";
import bcryptjs from "bcryptjs";
import db from "../db/connection";
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
import {
  selectEvents,
  selectEventRegistrationsByEventId,
} from "../models/events-models";
import { selectTeams } from "../models/teams-models";
import { fetchAllTickets } from "../models/tickets-models";
import { Event, EventResponse } from "../types";

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
    const { users, total_users } = await selectUsers();
    // Sanitize all users
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
    const user = await selectUserById(Number(id));
    // Sanitize user
    const sanitizedUser = sanitizeUser(user);
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
    const user = await selectUserById(Number(id));
    const is_site_admin = user?.is_site_admin;
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

// Get all event registrations for a user
export const getUserEventRegistrations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  try {
    // First check if the user exists
    await selectUserById(Number(id));

    // Get the registrations
    const registrations = await selectUserEventRegistrations(Number(id));

    res.status(200).send({
      status: "success",
      registrations,
    });
  } catch (err) {
    next(err);
  }
};

// Admin Dashboard - Get all platform data for site admins
export const getAdminDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if the user is a site admin
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        msg: "Unauthorized - Authentication required",
      });
    }

    // Get the user from the database to check if they are a site admin
    const user = await selectUserById(req.user.id);
    if (user && !user.is_site_admin) {
      return res.status(403).json({
        status: "error",
        msg: "Forbidden - Site admin access required",
      });
    }

    // Get all data needed for admin dashboard
    const { users, total_users } = await selectUsers();

    // Get all events including draft events (site admin can see all)
    const { events, total_events } = await selectEvents();

    // Get all teams
    const { teams, total_teams } = await selectTeams();

    // Get all tickets
    const tickets = await fetchAllTickets();

    // Get all registrations
    const registrationsPromise = (events as any[]).map(async (event) => {
      return selectEventRegistrationsByEventId(Number(event.id));
    });

    const registrations = await Promise.all(registrationsPromise);

    // Get all draft events specifically
    const draftEventsQuery = `
      SELECT 
        e.*,
        t.name as team_name,
        tm.username as creator_username
      FROM events e
      LEFT JOIN teams t ON e.team_id = t.id
      LEFT JOIN team_members tm_link ON e.created_by = tm_link.id
      LEFT JOIN users tm ON tm_link.user_id = tm.id
      WHERE e.status = 'draft'
      ORDER BY e.start_time ASC
    `;

    const draftEventsResult = await db.query(draftEventsQuery);
    const draftEvents = draftEventsResult.rows.map((event: any) => ({
      ...event,
      id: Number(event.id),
      team_id: event.team_id ? Number(event.team_id) : null,
      created_by: event.created_by ? Number(event.created_by) : null,
      price: event.price ? Number(event.price) : null,
      max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
    }));

    // Sanitize all users to remove password hashes
    const sanitizedUsers = sanitizeUsers(users);

    // Return all data
    res.status(200).json({
      status: "success",
      data: {
        users: sanitizedUsers,
        total_users,
        events,
        total_events,
        draft_events: draftEvents,
        teams,
        total_teams,
        tickets,
        registrations: registrations.flat(),
      },
    });
  } catch (err) {
    next(err);
  }
};
