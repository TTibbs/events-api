import { Request, Response, NextFunction } from "express";
import db from "../db/connection";
import {
  selectEvents,
  selectEventById,
  insertEvent,
  updateEventById,
  deleteEventById,
  selectEventRegistrationsByEventId,
  selectUpcomingEvents,
  selectEventsByTeamId,
  registerUserForEvent,
  cancelRegistration,
  checkEventAvailability,
  getRegistrationById,
  selectDraftEvents,
  selectDraftEventById,
  selectDraftEventsByTeamId,
} from "../models/events-models";
import { selectTeamMemberByUserId } from "../models/teams-models";

export const getEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { events, total_events } = await selectEvents();
    res.status(200).send({ events, total_events });
  } catch (err) {
    next(err);
  }
};

export const getDraftEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        msg: "Unauthorized - Authentication required",
      });
    }

    const events = await selectDraftEvents(req.user.id);
    res.status(200).send({ events });
  } catch (err) {
    next(err);
  }
};

export const getEventById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    const event = await selectEventById(Number(id));
    res.status(200).send({ event });
  } catch (err) {
    next(err);
  }
};

export const getDraftEventById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  try {
    const event = await selectDraftEventById(Number(id), req.user.id);
    res.status(200).send({ event });
  } catch (err) {
    next(err);
  }
};

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const {
    status,
    title,
    description,
    location,
    start_time,
    end_time,
    max_attendees,
    price,
    event_type,
    is_public,
    team_id,
    created_by,
  } = req.body;

  // Check user authorization
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  try {
    // Get the user's team membership
    const teamMember = await selectTeamMemberByUserId(req.user.id);

    if (!teamMember) {
      return res.status(403).json({
        status: "error",
        msg: "Forbidden - You are not a member of any team",
      });
    }

    // Use team_id from request if provided, otherwise use the user's team
    const eventTeamId = team_id ? parseInt(team_id) : teamMember.team_id;

    // Check if the user is authorized to create events for this team
    if (
      teamMember.team_id !== eventTeamId ||
      (teamMember.role !== "team_admin" && teamMember.role !== "event_manager")
    ) {
      return res.status(403).json({
        status: "error",
        msg: "Forbidden - You don't have permission to create events for this team",
      });
    }

    // Required fields and validation are now handled by express-validator middleware

    const eventStatus = status || "draft"; // Default to draft if not provided
    const eventIsPublic = is_public !== undefined ? is_public : true; // Default to public if not provided

    // Use the authenticated user's team member ID as created_by if not provided
    let createdBy = created_by;
    if (!createdBy) {
      createdBy = teamMember.id;
    }

    const newEvent = await insertEvent(
      eventStatus,
      title,
      description || null,
      location || null,
      new Date(start_time),
      new Date(end_time),
      max_attendees ? Number(max_attendees) : null,
      price ? Number(price) : null,
      event_type || null,
      eventIsPublic,
      eventTeamId,
      createdBy ? Number(createdBy) : null
    );

    res.status(201).send({ event: newEvent });
  } catch (err) {
    next(err);
  }
};

export const updateEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const updateData = req.body;

  // Check user authorization
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  try {
    // Get the event to check which team it belongs to - query directly
    const eventQuery = await db.query(`SELECT * FROM events WHERE id = $1`, [
      id,
    ]);

    if (eventQuery.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        msg: "Event not found",
      });
    }

    const event = eventQuery.rows[0];

    // Check if the user is authorized to update this event
    const teamMember = await selectTeamMemberByUserId(req.user.id);

    if (
      !teamMember ||
      teamMember.team_id !== Number(event.team_id) ||
      (teamMember.role !== "team_admin" && teamMember.role !== "event_manager")
    ) {
      return res.status(403).json({
        status: "error",
        msg: "Forbidden - You don't have permission to update this event",
      });
    }

    // Validation is now handled by express-validator middleware

    // Convert numeric values
    if (updateData.team_id) updateData.team_id = Number(updateData.team_id);
    if (updateData.created_by)
      updateData.created_by = Number(updateData.created_by);
    if (updateData.max_attendees)
      updateData.max_attendees = Number(updateData.max_attendees);
    if (updateData.price) updateData.price = Number(updateData.price);
    if (updateData.start_time)
      updateData.start_time = new Date(updateData.start_time);
    if (updateData.end_time)
      updateData.end_time = new Date(updateData.end_time);

    const updatedEvent = await updateEventById(Number(id), updateData);
    res.status(200).send({ updatedEvent });
  } catch (err) {
    next(err);
  }
};

export const deleteEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  // Check user authorization
  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  try {
    // Get the event to check which team it belongs to - query directly
    const eventQuery = await db.query(`SELECT * FROM events WHERE id = $1`, [
      id,
    ]);

    if (eventQuery.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        msg: "Event not found",
      });
    }

    const event = eventQuery.rows[0];

    // Check if the user is authorized to delete this event
    const teamMember = await selectTeamMemberByUserId(req.user.id);

    if (
      !teamMember ||
      teamMember.team_id !== Number(event.team_id) ||
      (teamMember.role !== "team_admin" && teamMember.role !== "event_manager")
    ) {
      return res.status(403).json({
        status: "error",
        msg: "Forbidden - You don't have permission to delete this event",
      });
    }

    await deleteEventById(Number(id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const getEventRegistrations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  try {
    // First query the event directly to see if it exists
    const eventQuery = await db.query(`SELECT * FROM events WHERE id = $1`, [
      id,
    ]);

    if (eventQuery.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        msg: "Event not found",
      });
    }

    const event = eventQuery.rows[0];

    // If the event is a draft, check if the user is authorized to view it
    if (event.status === "draft") {
      if (!req.user) {
        return res.status(404).json({
          status: "error",
          msg: "Event not found",
        });
      }

      // Try to find the draft event with the user's ID to confirm access
      try {
        await selectDraftEventById(Number(id), req.user.id);
      } catch (error) {
        return res.status(404).json({
          status: "error",
          msg: "Event not found",
        });
      }
    } else if (event.status !== "published") {
      // If the event exists but isn't published or draft, return 404
      return res.status(404).json({
        status: "error",
        msg: "Event not found",
      });
    }

    // If we got here, either:
    // 1. The event is published, or
    // 2. The event is draft and the user has access to it
    const registrations = await selectEventRegistrationsByEventId(Number(id));
    res.status(200).send({ registrations });
  } catch (err) {
    next(err);
  }
};

export const getUpcomingEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const events = await selectUpcomingEvents(limit);
    res.status(200).send({ events });
  } catch (err) {
    next(err);
  }
};

export const getEventsByTeamId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { teamId } = req.params;
  try {
    const events = await selectEventsByTeamId(Number(teamId));
    res.status(200).send({ events });
  } catch (err) {
    next(err);
  }
};

export const getDraftEventsByTeamId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { teamId } = req.params;

  if (!req.user) {
    return res.status(401).json({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  try {
    const events = await selectDraftEventsByTeamId(Number(teamId), req.user.id);
    res.status(200).send({ events });
  } catch (err) {
    next(err);
  }
};

// Register a user for an event
export const registerForEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;

    // Authentication is required
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "Authentication required" });
    }

    // Check for empty request body or undefined userId
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ msg: "User ID is required" });
    }

    // Use the authenticated user's ID by default
    let userId = req.user.id;

    // If userId is provided in body and different from authenticated user,
    // this could be an admin registering someone else - use that ID
    if (req.body.userId !== undefined) {
      // In a real app, we would check if the user has admin permissions here
      // For example: if (req.user.role === 'admin') { ... }
      userId = Number(req.body.userId);
    }

    const registration = await registerUserForEvent(Number(eventId), userId);

    // If registration was reactivated, return 200 instead of 201
    const statusCode = registration.reactivated ? 200 : 201;

    res.status(statusCode).json({
      msg: registration.reactivated
        ? "Registration reactivated successfully"
        : "Registration successful",
      registration,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel a registration
export const cancelEventRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;

    // Authentication is required
    if (!req.user || !req.user.id) {
      return res.status(401).json({ msg: "Authentication required" });
    }

    // Get the registration
    const registration = await getRegistrationById(Number(registrationId));

    if (!registration) {
      return res.status(404).json({ msg: "Registration not found" });
    }

    // Check if the registration belongs to the authenticated user
    // In a real app, we would also allow admins to cancel any registration
    // For example: if (req.user.role === 'admin' || registration.user_id === req.user.id) { ... }
    if (registration.user_id !== req.user.id) {
      return res
        .status(403)
        .json({ msg: "You can only cancel your own registrations" });
    }

    try {
      const cancelledRegistration = await cancelRegistration(
        Number(registrationId)
      );

      res.status(200).json({
        msg: "Registration cancelled successfully",
        registration: cancelledRegistration,
      });
    } catch (error: any) {
      // Handle specific error for already cancelled registration
      if (
        error.status === 400 &&
        error.msg === "Registration is already cancelled"
      ) {
        return res.status(400).json({
          msg: "Registration is already cancelled",
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// Check event availability
export const checkEventRegistrationAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;

    const availability = await checkEventAvailability(Number(eventId));

    res.status(200).json({
      available: availability.available,
      ...(!availability.available && { reason: availability.reason }),
    });
  } catch (error) {
    next(error);
  }
};
