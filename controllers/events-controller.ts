import { Request, Response, NextFunction } from "express";
import {
  selectEvents,
  selectPastEvents,
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
  getEventByIdForAdmin,
  selectCategoryByName,
  selectCategories,
} from "../models/events-models";
import { selectTeamMemberByUserId } from "../models/teams-models";
import { sendRegistrationConfirmation } from "../utils/email";
import {
  EmailInfo,
  Event,
  EventRegistrationResponse,
  EventUpdateData,
  ExtendedEventRegistration,
  ExtendedTeamMember,
} from "../types";

export const getEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { sort_by, order, category, limit = 10, page = 1 } = req.query;

    // Validate numeric parameters
    if (
      isNaN(Number(limit)) ||
      isNaN(Number(page)) ||
      Number(limit) <= 0 ||
      Number(page) <= 0
    ) {
      return res.status(400).send({
        status: "error",
        msg: "Limit and page must be positive numbers",
      });
    }

    const { events, total_events, total_pages } = await selectEvents(
      sort_by as string | undefined,
      order as string | undefined,
      category as string | undefined,
      Number(limit),
      Number(page)
    );

    res.status(200).send({
      events,
      total_events,
      total_pages,
    });
  } catch (err: any) {
    if (err.status) {
      res.status(err.status).send({ status: "error", msg: err.msg });
    } else {
      next(err);
    }
  }
};

export const getPastEvents = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { events, total_pages } = await selectPastEvents();
    res.status(200).send({ events, total_pages });
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const categories = await selectCategories();
    res.status(200).send({ categories });
  } catch (err) {
    next(err);
  }
};

export const getCategoryByName = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { name } = req.params;
  try {
    const category = await selectCategoryByName(name);
    res.status(200).send({ category });
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
      return res.status(401).send({
        status: "error",
        msg: "Unauthorized - Authentication required",
      });
    }

    const isMemberOfTeam = await selectTeamMemberByUserId(req.user.id);

    if (req.user.id !== isMemberOfTeam?.id) {
      return res.status(403).send({
        status: "error",
        msg: "Forbidden - You are not a member of this team",
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
    // If user is authenticated, use the authenticated flow with draft visibility
    if (req.user?.id) {
      const userId = req.user.id;
      try {
        // Check if user is a team member
        const isMemberOfTeam = await selectTeamMemberByUserId(userId);

        // If user is a team member, show them the event (published or draft if they have access)
        if (isMemberOfTeam) {
          const event = await selectEventById(Number(id), userId);
          return res.status(200).send({ event });
        } else {
          // Regular user, try to get the event if it's published
          try {
            const event = await selectEventById(Number(id), userId);
            return res.status(200).send({ event });
          } catch (err: any) {
            if (err.status === 404) {
              return res.status(404).send({
                status: "error",
                msg: "Event not found",
              });
            }
            throw err;
          }
        }
      } catch (err: any) {
        if (err.status === 404) {
          return res.status(404).send({
            status: "error",
            msg: "Event not found",
          });
        }
        throw err;
      }
    } else {
      // For non-authenticated users, only allow access to published events
      try {
        // Use getEventByIdForAdmin and check if it's published
        const event = await getEventByIdForAdmin(Number(id));
        if (event.status !== "published") {
          return res.status(404).send({
            status: "error",
            msg: "Event not found",
          });
        }
        return res.status(200).send({ event });
      } catch (err: any) {
        if (err.status === 404) {
          return res.status(404).send({
            status: "error",
            msg: "Event not found",
          });
        }
        throw err;
      }
    }
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
    return res.status(401).send({
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
    event_img_url,
    location,
    start_time,
    end_time,
    max_attendees,
    price,
    category,
    is_public,
    team_id,
    created_by,
  } = req.body;

  // Check user authorization
  if (!req.user) {
    return res.status(401).send({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  try {
    // Get the user's team membership
    const teamMember = (await selectTeamMemberByUserId(
      req.user.id
    )) as ExtendedTeamMember | null;

    if (!teamMember) {
      return res.status(403).send({
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
      return res.status(403).send({
        status: "error",
        msg: "Forbidden - You don't have permission to create events for this team",
      });
    }

    // Required fields and validation are now handled by express-validator middleware

    const eventStatus = status || "draft"; // Default to draft if not provided
    const eventIsPublic = is_public !== undefined ? is_public : true; // Default to public if not provided

    // Use the authenticated user's team member ID as created_by if not provided
    let createdBy: number | null = created_by ? Number(created_by) : null;
    if (!createdBy && teamMember.id) {
      createdBy = teamMember.id;
    }

    const newEvent = await insertEvent(
      eventStatus,
      title,
      description || null,
      event_img_url || null,
      location || null,
      new Date(start_time),
      new Date(end_time),
      max_attendees ? Number(max_attendees) : null,
      price ? Number(price) : null,
      category || null,
      eventIsPublic,
      eventTeamId,
      createdBy
    );

    res
      .status(201)
      .send({ event: newEvent, msg: "Event created successfully" });
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
  const updateData: EventUpdateData = req.body;

  // Check user authorization
  if (!req.user) {
    return res.status(401).send({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  try {
    // Get the event to check which team it belongs to
    let eventCheck;
    try {
      eventCheck = await getEventByIdForAdmin(Number(id));
    } catch (error: any) {
      if (error.status === 404) {
        return res.status(404).send({
          status: "error",
          msg: "Event not found",
        });
      }
      throw error;
    }

    // Check if the user is authorized to update this event
    const teamMember = (await selectTeamMemberByUserId(
      req.user.id
    )) as ExtendedTeamMember | null;

    if (
      !teamMember ||
      teamMember.team_id !== Number(eventCheck.team_id) ||
      (teamMember.role !== "team_admin" && teamMember.role !== "event_manager")
    ) {
      return res.status(403).send({
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

    // Cast updateData to Partial<Event> to match what updateEventById expects
    const updatedEvent = await updateEventById(
      Number(id),
      updateData as Partial<Event>
    );
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
    return res.status(401).send({
      status: "error",
      msg: "Unauthorized - Authentication required",
    });
  }

  try {
    // Get the event to check which team it belongs to
    let eventCheck;
    try {
      eventCheck = await getEventByIdForAdmin(Number(id));
    } catch (error: any) {
      if (error.status === 404) {
        return res.status(404).send({
          status: "error",
          msg: "Event not found",
        });
      }
      throw error;
    }

    // Check if the user is authorized to delete this event
    const teamMember = (await selectTeamMemberByUserId(
      req.user.id
    )) as ExtendedTeamMember | null;

    if (
      !teamMember ||
      teamMember.team_id !== Number(eventCheck.team_id) ||
      (teamMember.role !== "team_admin" && teamMember.role !== "event_manager")
    ) {
      return res.status(403).send({
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
    let eventCheck;

    // First check if the event exists
    try {
      eventCheck = await getEventByIdForAdmin(Number(id));
    } catch (error) {
      return res.status(404).send({
        status: "error",
        msg: "Event not found",
      });
    }

    // If user is authenticated, check their permissions
    if (req.user?.id) {
      const userId = req.user.id;
      const teamMember = await selectTeamMemberByUserId(userId);

      // If the event is not published and user is not on the team that owns it, restrict access
      if (
        eventCheck.status !== "published" &&
        (!teamMember || teamMember.team_id !== eventCheck.team_id)
      ) {
        return res.status(404).send({
          status: "error",
          msg: "Event not found",
        });
      }
    } else {
      // Non-authenticated users can only access registrations for published events
      if (eventCheck.status !== "published") {
        return res.status(404).send({
          status: "error",
          msg: "Event not found",
        });
      }
    }

    // If we got here, the user has access to the registrations
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
    return res.status(401).send({
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

export const registerForEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;

    // Validate eventId is a number
    const eventIdNum = Number(eventId);
    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({
        status: "error",
        msg: "Invalid event ID format",
      });
    }

    // Authentication is required
    if (!req.user || !req.user.id) {
      return res.status(401).send({ msg: "Authentication required" });
    }

    // Check for empty request body or undefined userId
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).send({ msg: "User ID is required" });
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

    // console.log(`Registering user ${userId} for event ${eventId}`);
    const registration = (await registerUserForEvent(
      eventIdNum,
      userId
    )) as ExtendedEventRegistration;

    // Send confirmation email if registration was successful
    if (registration.ticket_info) {
      try {
        // console.log(
        //   `Attempting to send email to ${registration.ticket_info.user_email}`
        // );
        // console.log(
        //   `SENDGRID_API_KEY is ${
        //     process.env.SENDGRID_API_KEY ? "set" : "not set"
        //   }`
        // );
        // console.log(
        //   `SENDGRID_FROM_EMAIL is ${
        //     process.env.SENDGRID_FROM_EMAIL
        //       ? process.env.SENDGRID_FROM_EMAIL
        //       : "not set"
        //   }`
        // );
        const emailInfo: EmailInfo = {
          to: registration.ticket_info.user_email,
          name: registration.ticket_info.user_name,
          eventTitle: registration.ticket_info.event_title,
          eventDate: registration.ticket_info.event_date,
          eventLocation: registration.ticket_info.event_location,
          ticketCode: registration.ticket_info.ticket_code,
        };
        const emailResult = await sendRegistrationConfirmation(emailInfo);
        // console.log(
        //   `Email sending result: ${emailResult.success ? "success" : "failed"}`
        // );
        // if (!emailResult.success) {
        //   console.error("Email error details:", emailResult.error);
        // } else {
        //   console.log(
        //     `Confirmation email sent for registration ID: ${registration.id}`
        //   );
        // }
      } catch (emailError) {
        // Log the error but don't fail the registration process
        console.error("Failed to send confirmation email:", emailError);
      }
    } else {
      console.warn("No ticket_info available for sending confirmation email");
    }

    // If registration was reactivated, return 200 instead of 201
    const statusCode = registration.reactivated ? 200 : 201;

    res.status(statusCode).send({
      msg: registration.reactivated
        ? "Registration reactivated successfully"
        : "Registration successful",
      registration,
    });
  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};

export const cancelEventRegistration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { registrationId } = req.params;

    // Authentication is required
    if (!req.user || !req.user.id) {
      return res.status(401).send({ msg: "Authentication required" });
    }

    // Get the registration
    const registration = (await getRegistrationById(
      Number(registrationId)
    )) as EventRegistrationResponse | null;

    if (!registration) {
      return res.status(404).send({ msg: "Registration not found" });
    }

    // Check if the registration belongs to the authenticated user
    // In a real app, we would also allow admins to cancel any registration
    // For example: if (req.user.role === 'admin' || registration.user_id === req.user.id) { ... }
    if (registration.user_id !== req.user.id) {
      return res
        .status(403)
        .send({ msg: "You can only cancel your own registrations" });
    }

    try {
      const cancelledRegistration = (await cancelRegistration(
        Number(registrationId)
      )) as EventRegistrationResponse;

      res.status(200).send({
        msg: "Registration cancelled successfully",
        registration: cancelledRegistration,
      });
    } catch (error: any) {
      // Handle specific error for already cancelled registration
      if (
        error.status === 400 &&
        error.msg === "Registration is already cancelled"
      ) {
        return res.status(400).send({
          msg: "Registration is already cancelled",
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const checkEventRegistrationAvailability = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { eventId } = req.params;

    // Validate eventId is a number
    const eventIdNum = Number(eventId);
    if (isNaN(eventIdNum) || eventIdNum <= 0) {
      return res.status(400).json({
        status: "error",
        msg: "Invalid event ID format",
      });
    }

    const availability = await checkEventAvailability(eventIdNum);

    res.status(200).send({
      available: availability.available,
      ...(!availability.available && { reason: availability.reason }),
    });
  } catch (error) {
    next(error);
  }
};
