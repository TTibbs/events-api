import { Router, RequestHandler } from "express";
import {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventRegistrations,
  getUpcomingEvents,
  getEventsByTeamId,
  registerForEvent,
  cancelEventRegistration,
  checkEventRegistrationAvailability,
} from "../controllers/events-controller";
import { authenticate, authMiddleware } from "../middlewares/auth-middleware";

const eventsRouter = Router();

// Cast controller functions to RequestHandler type
const getEventsHandler = getEvents as RequestHandler;
const getEventByIdHandler = getEventById as RequestHandler;
const createEventHandler = createEvent as RequestHandler;
const updateEventHandler = updateEvent as RequestHandler;
const deleteEventHandler = deleteEvent as RequestHandler;
const getEventRegistrationsHandler = getEventRegistrations as RequestHandler;
const getUpcomingEventsHandler = getUpcomingEvents as RequestHandler;
const getEventsByTeamIdHandler = getEventsByTeamId as RequestHandler;
const registerForEventHandler = registerForEvent as RequestHandler;
const cancelEventRegistrationHandler =
  cancelEventRegistration as RequestHandler;
const checkEventRegistrationAvailabilityHandler =
  checkEventRegistrationAvailability as RequestHandler;
const authenticateHandler = authMiddleware.isAuthenticated as RequestHandler;

// GET /api/events - Get all events
eventsRouter.get("/", getEventsHandler);

// GET /api/events/upcoming - Get upcoming events
eventsRouter.get("/upcoming", getUpcomingEventsHandler);

// GET /api/events/team/:teamId - Get events by team ID
eventsRouter.get("/team/:teamId", getEventsByTeamIdHandler);

// GET /api/events/:id - Get event by ID
eventsRouter.get("/:id", getEventByIdHandler);

// GET /api/events/:id/registrations - Get registrations for an event
eventsRouter.get(
  "/:id/registrations",
  authenticateHandler,
  getEventRegistrationsHandler
);

// GET /api/events/:eventId/availability - Check event availability for registration
eventsRouter.get(
  "/:eventId/availability",
  checkEventRegistrationAvailabilityHandler
);

// POST /api/events - Create a new event
// Requires team admin or event_manager role
eventsRouter.post("/", authenticateHandler, createEventHandler);

// PATCH /api/events/:id - Update an event
// Requires team admin or event_manager role for the specific event
eventsRouter.patch("/:id", authenticateHandler, updateEventHandler);

// DELETE /api/events/:id - Delete an event
// Requires team admin or event_manager role for the specific event
eventsRouter.delete("/:id", authenticateHandler, deleteEventHandler);

// POST /api/events/:eventId/register - Register for an event
// Requires authentication
eventsRouter.post(
  "/:eventId/register",
  authenticateHandler,
  registerForEventHandler
);

// PATCH /api/registrations/:registrationId/cancel - Cancel registration
// Requires authentication
eventsRouter.patch(
  "/registrations/:registrationId/cancel",
  authenticateHandler,
  cancelEventRegistrationHandler
);

export default eventsRouter;
