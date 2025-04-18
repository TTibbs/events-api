import { Request, Response, NextFunction } from "express";
import * as ticketModels from "../models/tickets-models";
import * as userModels from "../models/users-models";
import { Ticket, TicketResponse } from "../types";
import crypto from "crypto";
import { toNumber } from "../utils/converters";
import { validateRequiredFields, validateId } from "../utils/error-handlers";

// Get all tickets
export const getAllTickets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const tickets = await ticketModels.fetchAllTickets();
    res.status(200).send({ tickets });
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
    const ticketId = Number(req.params.id);
    const ticket = await ticketModels.fetchTicketById(ticketId);
    res.status(200).send({ ticket });
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
    const userId = Number(req.params.userId);

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).send({ msg: "Authentication required" });
    }

    // Check if the user exists
    try {
      await userModels.selectUserById(userId);
    } catch (error: any) {
      if (error.status === 404) {
        return res.status(404).send({ msg: "User not found" });
      }
      throw error;
    }

    // Only allow users to view their own tickets
    if (req.user.id !== userId) {
      return res
        .status(403)
        .send({ msg: "You can only view your own tickets" });
    }

    const tickets = await ticketModels.fetchTicketsByUserId(userId);
    res.status(200).send({ tickets });
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
    const eventId = Number(req.params.eventId);
    const tickets = await ticketModels.fetchTicketsByEventId(eventId);
    res.status(200).send({ tickets });
  } catch (err) {
    next(err);
  }
};

export const getHasUserPaid = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId, eventId } = req.params;

    // Validate that userId and eventId are numbers
    if (isNaN(Number(userId)) || isNaN(Number(eventId))) {
      return res.status(400).send({
        status: "error",
        msg: "User ID and Event ID must be valid numbers",
      });
    }

    const hasUserPaid = await ticketModels.hasUserPaid(
      Number(userId),
      Number(eventId)
    );

    res.status(200).send({ hasUserPaid });
  } catch (err: any) {
    if (err.status && err.msg) {
      return res.status(err.status).send({
        status: "error",
        msg: err.msg,
      });
    }
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
      return res.status(400).send({
        status: "error",
        msg: "Ticket code is required",
      });
    }

    const ticket = await ticketModels.fetchTicketByCode(ticketCode);

    // Check ticket validity
    if (ticket.status !== "valid") {
      return res.status(400).send({
        status: "error",
        msg: `Ticket is ${ticket.status}`,
        ticket,
      });
    }

    // Check if event has already passed
    const eventEndTime = new Date(ticket.end_time);
    if (eventEndTime < new Date()) {
      return res.status(400).send({
        status: "error",
        msg: "Event has already ended",
        ticket,
      });
    }

    res.status(200).send({
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
      return res.status(validationError.status).send({
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
      return res.status(400).send({
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

    res.status(201).send({
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
      return res.status(400).send({
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

    res.status(200).send({
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

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).send({ msg: "Authentication required" });
    }

    const userId = req.user.id;

    // Find the ticket
    const ticket = (await ticketModels.fetchTicketByCode(
      ticketCode
    )) as TicketResponse;

    if (!ticket) {
      return res.status(404).send({
        status: "error",
        msg: "Ticket not found",
      });
    }

    // Verify that the ticket belongs to the authenticated user
    if (ticket.user_id !== userId) {
      return res.status(403).send({
        status: "error",
        msg: "You can only use your own tickets",
      });
    }

    // Check if ticket is already used
    if (ticket.status === "used") {
      return res.status(400).send({
        status: "error",
        msg: "Ticket has already been used",
        usedAt: ticket.used_at,
      });
    }

    // Check if ticket is valid
    if (ticket.status !== "valid") {
      return res.status(400).send({
        status: "error",
        msg: `Cannot use ticket with status: ${ticket.status}`,
      });
    }

    // Mark the ticket as used
    const updatedTicket = await ticketModels.updateTicketStatus(
      ticket.id,
      "used"
    );

    res.status(200).send({
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
    const ticketId = validateId(req.params.id, "Ticket");

    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).send({ msg: "Authentication required" });
    }

    const userId = req.user.id;

    // Get the ticket to check ownership
    const ticket = (await ticketModels.fetchTicketById(
      ticketId
    )) as TicketResponse;

    if (!ticket) {
      return res.status(404).send({
        status: "error",
        msg: "Ticket not found",
      });
    }

    // Verify that the ticket belongs to the authenticated user
    if (ticket.user_id !== userId) {
      return res.status(403).send({
        status: "error",
        msg: "You can only delete your own tickets",
      });
    }

    const deletedTicket = await ticketModels.deleteTicket(ticketId);

    if (!deletedTicket) {
      return res.status(404).send({
        status: "error",
        msg: "Ticket not found",
      });
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
