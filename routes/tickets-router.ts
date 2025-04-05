import { Router, RequestHandler } from "express";
import * as ticketsController from "../controllers/tickets-controller";

const ticketsRouter = Router();

// Cast controller functions to RequestHandler
const getAllTicketsHandler = ticketsController.getAllTickets as RequestHandler;
const getTicketByIdHandler = ticketsController.getTicketById as RequestHandler;
const getTicketsByUserIdHandler =
  ticketsController.getTicketsByUserId as RequestHandler;
const getTicketsByEventIdHandler =
  ticketsController.getTicketsByEventId as RequestHandler;
const verifyTicketHandler = ticketsController.verifyTicket as RequestHandler;
const createNewTicketHandler =
  ticketsController.createNewTicket as RequestHandler;
const useTicketHandler = ticketsController.useTicket as RequestHandler;
const updateTicketHandler = ticketsController.updateTicket as RequestHandler;
const deleteTicketByIdHandler =
  ticketsController.deleteTicketById as RequestHandler;

// GET routes - specific routes first
ticketsRouter.get("/user/:userId", getTicketsByUserIdHandler);
ticketsRouter.get("/event/:eventId", getTicketsByEventIdHandler);
ticketsRouter.get("/verify/:ticketCode", verifyTicketHandler);
ticketsRouter.get("/:id", getTicketByIdHandler);
ticketsRouter.get("/", getAllTicketsHandler);

// POST routes
ticketsRouter.post("/use/:ticketCode", useTicketHandler);
ticketsRouter.post("/", createNewTicketHandler);

// PATCH routes
ticketsRouter.patch("/:id", updateTicketHandler);

// DELETE routes
ticketsRouter.delete("/:id", deleteTicketByIdHandler);

export default ticketsRouter;
