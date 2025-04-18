import { Router, RequestHandler } from "express";
import * as ticketsController from "../controllers/tickets-controller";
import { authMiddleware } from "../middlewares/auth-middleware";

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
const getHasUserPaidHandler =
  ticketsController.getHasUserPaid as RequestHandler;
const authenticateHandler = authMiddleware.isAuthenticated as RequestHandler;

// GET routes - specific routes first
// Get tickets by user ID - requires authentication
ticketsRouter.get(
  "/user/:userId",
  authenticateHandler,
  getTicketsByUserIdHandler
);
ticketsRouter.get("/event/:eventId", getTicketsByEventIdHandler);
ticketsRouter.get("/verify/:ticketCode", verifyTicketHandler);
ticketsRouter.get("/:id", getTicketByIdHandler);
ticketsRouter.get("/", getAllTicketsHandler);
ticketsRouter.get("/user/:userId/event/:eventId", getHasUserPaidHandler);

// POST routes
// Use ticket - requires authentication
ticketsRouter.post("/use/:ticketCode", authenticateHandler, useTicketHandler);
// Create new ticket - requires authentication
ticketsRouter.post("/", authenticateHandler, createNewTicketHandler);

// PATCH routes
// Update ticket - requires authentication
ticketsRouter.patch("/:id", authenticateHandler, updateTicketHandler);

// DELETE routes
// Delete ticket - requires authentication
ticketsRouter.delete("/:id", authenticateHandler, deleteTicketByIdHandler);

export default ticketsRouter;
