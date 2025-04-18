import { Request, Response, NextFunction } from "express";
import { selectUserById, selectUsers } from "../models/users-models";
import {
  selectEventRegistrationsByEventId,
  selectEvents,
} from "../models/events-models";
import { selectTeams } from "../models/teams-models";
import { fetchAllTickets } from "../models/tickets-models";
import { checkIsUserSiteAdmin } from "./users-controller";
import db from "../db/connection";
import { updateUserToAdmin } from "../models/admin-models";
import { sanitizeUser, sanitizeUsers } from "../utils/databaseHelpers";
import {
  AdminDashboardData,
  EventResponse,
  TeamResponse,
  User,
} from "../types";

export const getAdminDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if the user is authenticated
    if (!req.user) {
      return res.status(401).send({
        status: "error",
        msg: "Unauthorized - Authentication required",
      });
    }

    // Check if the user is a site admin
    const is_site_admin = await checkIsUserSiteAdmin(req.user.id);
    if (!is_site_admin) {
      return res.status(403).send({
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
    const registrationsPromise = (events as EventResponse[]).map(
      async (event) => {
        return selectEventRegistrationsByEventId(Number(event.id));
      }
    );

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
    const draftEvents = draftEventsResult.rows.map((event) => ({
      ...event,
      id: Number(event.id),
      team_id: event.team_id ? Number(event.team_id) : null,
      created_by: event.created_by ? Number(event.created_by) : null,
      price: event.price ? Number(event.price) : null,
      max_attendees: event.max_attendees ? Number(event.max_attendees) : null,
    })) as EventResponse[];

    // Sanitize all users to remove password hashes
    const sanitizedUsers = sanitizeUsers(users) as unknown as User[];

    // Return all data
    const dashboardData: AdminDashboardData = {
      users: sanitizedUsers,
      total_users,
      events: events as unknown as EventResponse[],
      total_events,
      draft_events: draftEvents,
      teams: teams as unknown as TeamResponse[],
      total_teams,
      tickets,
      registrations: registrations.flat(),
    };

    res.status(200).send({
      status: "success",
      data: dashboardData,
    });
  } catch (err) {
    next(err);
  }
};

export const promoteUserById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Check if the user is authenticated
    if (!req.user) {
      return res.status(401).send({
        status: "error",
        msg: "Unauthorized - Authentication required",
      });
    }

    // Check if the user is a site admin
    const is_site_admin = await checkIsUserSiteAdmin(req.user.id);
    if (!is_site_admin) {
      return res.status(403).send({
        status: "error",
        msg: "Forbidden - Site admin access required",
      });
    }

    const { id } = req.params;
    const { is_site_admin: newAdminStatus } = req.body;

    if (typeof newAdminStatus !== "boolean") {
      return res.status(400).send({
        status: "error",
        msg: "Invalid request - is_site_admin must be a boolean value",
      });
    }

    const user = await selectUserById(Number(id));
    if (!user) {
      return res.status(404).send({
        status: "error",
        msg: "User not found",
      });
    }

    const updatedUser = await updateUserToAdmin(Number(id), newAdminStatus);
    const sanitizedUser = sanitizeUser(updatedUser as User);

    res.status(200).send({
      status: "success",
      data: sanitizedUser,
    });
  } catch (err) {
    next(err);
  }
};
