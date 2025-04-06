import { Request, Response, NextFunction } from "express";
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
} from "../models/events-models";

export const getEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const events = await selectEvents();
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

  // Validate required fields
  const errors = [];
  if (!title) {
    errors.push("Event title is required");
  }

  if (!start_time) {
    errors.push("Start time is required");
  }

  if (!end_time) {
    errors.push("End time is required");
  }

  // Check if end_time is after start_time
  if (start_time && end_time && new Date(end_time) <= new Date(start_time)) {
    errors.push("End time must be after start time");
  }

  if (errors.length > 0) {
    return res.status(400).send({
      status: "error",
      msg: errors.length === 1 ? errors[0] : "Missing required fields",
      errors,
    });
  }

  try {
    const eventStatus = status || "draft"; // Default to draft if not provided
    const eventIsPublic = is_public !== undefined ? is_public : true; // Default to public if not provided

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
      team_id ? Number(team_id) : null,
      created_by ? Number(created_by) : null
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

  // Validate data
  if (
    updateData.start_time &&
    updateData.end_time &&
    new Date(updateData.end_time) <= new Date(updateData.start_time)
  ) {
    return res.status(400).send({
      status: "error",
      msg: "End time must be after start time",
    });
  }

  try {
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
    res.status(200).send({ event: updatedEvent });
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
  try {
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

// Register a user for an event
export const registerForEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ msg: "User ID is required" });
    }

    const registration = await registerUserForEvent(
      Number(eventId),
      Number(userId)
    );

    res.status(201).json({
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

    const cancelledRegistration = await cancelRegistration(
      Number(registrationId)
    );

    res.status(200).json({
      msg: "Registration cancelled successfully",
      registration: cancelledRegistration,
    });
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
