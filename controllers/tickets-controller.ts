import { Request, Response, NextFunction } from "express";
import * as ticketModels from "../models/tickets-models";
import * as userModels from "../models/users-models";
import { Ticket } from "../types";
import crypto from "crypto";
import { validateId } from "../utils/validators";
import { validateRequiredFields } from "../utils/error-handlers";
import { toNumber } from "../utils/converters";

// Get all tickets
export const getAllTickets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tickets = await ticketModels.fetchAllTickets();
    res.status(200).json({ tickets });
  } catch (err) {
    next(err);
  }
};

// Get ticket by ID
export const getTicketById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ticketId = validateId(req.params.id, "Ticket");
    const ticket = await ticketModels.fetchTicketById(ticketId);
    res.status(200).json({ ticket });
  } catch (err) {
    next(err);
  }
};

// Get tickets by user ID
export const getTicketsByUserId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = validateId(req.params.userId, "User");

    // Check if user exists
    try {
      await userModels.selectUserById(userId);
    } catch (error: any) {
      if (error.status === 404) {
        return res.status(404).json({
          status: "error",
          msg: "User not found",
        });
      }
      throw error;
    }

    const tickets = await ticketModels.fetchTicketsByUserId(userId);
    res.status(200).json({ tickets });
  } catch (err) {
    next(err);
  }
};

// Get tickets by event ID
export const getTicketsByEventId = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const eventId = validateId(req.params.eventId, "Event");
    const tickets = await ticketModels.fetchTicketsByEventId(eventId);
    res.status(200).json({ tickets });
  } catch (err) {
    next(err);
  }
};

// Verify a ticket by code
export const verifyTicket = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ticketCode } = req.params;

    if (!ticketCode || ticketCode.trim() === "") {
      return res.status(400).json({
        status: "error",
        msg: "Ticket code is required",
      });
    }

    const ticket = await ticketModels.fetchTicketByCode(ticketCode);

    // Check ticket validity
    if (ticket.status !== "valid") {
      return res.status(400).json({
        status: "error",
        msg: `Ticket is ${ticket.status}`,
        ticket,
      });
    }

    // Check if event has already passed
    const eventEndTime = new Date(ticket.end_time);
    if (eventEndTime < new Date()) {
      return res.status(400).json({
        status: "error",
        msg: "Event has already ended",
        ticket,
      });
    }

    res.status(200).json({
      status: "success",
      msg: "Ticket is valid",
      ticket,
    });
  } catch (err) {
    next(err);
  }
};

// Create a new ticket
export const createNewTicket = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { event_id, user_id, registration_id } = req.body;

    // Validate required fields
    const validationError = validateRequiredFields({
      "Event ID": event_id,
      "User ID": user_id,
      "Registration ID": registration_id,
    });

    if (validationError) {
      return res.status(validationError.status).json({
        status: "error",
        msg: validationError.msg,
        errors: validationError.errors,
      });
    }

    // Ensure all IDs are valid numbers
    try {
      validateId(event_id, "Event");
      validateId(user_id, "User");
      validateId(registration_id, "Registration");
    } catch (error: any) {
      return res.status(400).json({
        status: "error",
        msg: error.msg,
      });
    }

    // Generate a unique ticket code
    const ticket_code = crypto
      .createHash("md5")
      .update(
        `${event_id}-${user_id}-${registration_id}-${Date.now()}-${Math.random()}`
      )
      .digest("hex");

    const newTicket: Ticket = {
      event_id: toNumber(event_id) as number,
      user_id: toNumber(user_id) as number,
      registration_id: toNumber(registration_id) as number,
      ticket_code,
      issued_at: new Date(),
      used_at: null,
      status: "valid",
    };

    const createdTicket = await ticketModels.createTicket(newTicket);

    res.status(201).json({
      status: "success",
      msg: "Ticket created successfully",
      ticket: createdTicket,
    });
  } catch (err) {
    next(err);
  }
};

// Update ticket status
export const updateTicket = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ticketId = validateId(req.params.id, "Ticket");
    const { status } = req.body;

    // Validate status
    const validStatuses = ["valid", "used", "cancelled", "expired"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        status: "error",
        msg: "Invalid ticket status",
        validOptions: validStatuses,
      });
    }

    // Update the ticket
    const updatedTicket = await ticketModels.updateTicketStatus(
      ticketId,
      status
    );

    res.status(200).json({
      status: "success",
      msg: "Ticket updated successfully",
      ticket: updatedTicket,
    });
  } catch (err) {
    next(err);
  }
};

// Mark ticket as used
export const useTicket = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { ticketCode } = req.params;

    // Find the ticket
    const ticket = await ticketModels.fetchTicketByCode(ticketCode);

    if (!ticket) {
      return res.status(404).json({
        status: "error",
        msg: "Ticket not found",
      });
    }

    // Check if ticket is already used
    if (ticket.status === "used") {
      return res.status(400).json({
        status: "error",
        msg: "Ticket has already been used",
        usedAt: ticket.used_at,
      });
    }

    // Check if ticket is valid
    if (ticket.status !== "valid") {
      return res.status(400).json({
        status: "error",
        msg: `Cannot use ticket with status: ${ticket.status}`,
      });
    }

    // Mark the ticket as used
    const updatedTicket = await ticketModels.updateTicketStatus(
      ticket.id,
      "used"
    );

    res.status(200).json({
      status: "success",
      msg: "Ticket marked as used",
      ticket: updatedTicket,
    });
  } catch (err) {
    next(err);
  }
};

// Delete a ticket
export const deleteTicketById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ticketId = parseInt(req.params.id);
    const deletedTicket = await ticketModels.deleteTicket(ticketId);

    if (!deletedTicket) {
      return res.status(404).json({
        status: "error",
        msg: "Ticket not found",
      });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
