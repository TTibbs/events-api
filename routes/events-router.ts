import {
  Router,
  RequestHandler,
  Request,
  Response,
  NextFunction,
} from "express";
import { body, validationResult } from "express-validator";
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
  getDraftEvents,
  getDraftEventById,
  getDraftEventsByTeamId,
} from "../controllers/events-controller";
import { authMiddleware } from "../middlewares/auth-middleware";

const eventsRouter = Router();

// Validation middleware
const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Check if there's a specific time validation error
    const timeError = errors
      .array()
      .find(
        (error) =>
          error.type === "field" &&
          error.msg === "End time must be after start time"
      );

    if (timeError) {
      // For PATCH requests, return the error as a msg
      if (req.method === "PATCH") {
        res.status(400).json({
          status: "error",
          msg: "End time must be after start time",
        });
        return;
      }
      // For POST requests, format the error to match the test expectations
      else {
        res.status(400).json({
          status: "error",
          errors: [
            {
              message: "End time must be after start time",
            },
          ],
        });
        return;
      }
    }

    // Handle other validation errors
    const formattedErrors = errors.array().map((error) => {
      if (error.type === "field") {
        return {
          field: error.path,
          message: error.msg,
        };
      }
      return {
        message: error.msg,
      };
    });

    res.status(400).json({
      status: "error",
      errors: formattedErrors,
    });
    return;
  }
  next();
};

// Event validation
const eventValidation = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Event title is required")
    .isLength({ min: 3, max: 200 })
    .withMessage("Event title must be between 3 and 200 characters"),
  body("start_time")
    .notEmpty()
    .withMessage("Start time is required")
    .isISO8601()
    .withMessage("Start time must be a valid date"),
  body("end_time")
    .notEmpty()
    .withMessage("End time is required")
    .isISO8601()
    .withMessage("End time must be a valid date")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.start_time)) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),
  body("team_id")
    .notEmpty()
    .withMessage("Team ID is required")
    .isNumeric()
    .withMessage("Team ID must be a number"),
];

// Event update validation - all fields optional
const eventUpdateValidation = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage("Event title must be between 3 and 200 characters"),
  body("start_time")
    .optional()
    .isISO8601()
    .withMessage("Start time must be a valid date"),
  body("end_time")
    .optional()
    .isISO8601()
    .withMessage("End time must be a valid date")
    .custom((value, { req }) => {
      if (
        req.body.start_time &&
        new Date(value) <= new Date(req.body.start_time)
      ) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),
  body("team_id")
    .optional()
    .isNumeric()
    .withMessage("Team ID must be a number"),
];

// Registration validation
const registerValidation = [
  body("user_id")
    .optional()
    .isNumeric()
    .withMessage("User ID must be a number"),
];

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
const getDraftEventsHandler = getDraftEvents as RequestHandler;
const getDraftEventByIdHandler = getDraftEventById as RequestHandler;
const getDraftEventsByTeamIdHandler = getDraftEventsByTeamId as RequestHandler;
const authenticateHandler = authMiddleware.isAuthenticated as RequestHandler;

// GET /api/events - Get all published events
eventsRouter.get("/", getEventsHandler);

// GET /api/events/draft - Get all draft events for the authenticated user's teams
eventsRouter.get("/draft", authenticateHandler, getDraftEventsHandler);

// GET /api/events/upcoming - Get upcoming events
eventsRouter.get("/upcoming", getUpcomingEventsHandler);

// GET /api/events/team/:teamId - Get published events by team ID
eventsRouter.get("/team/:teamId", getEventsByTeamIdHandler);

// GET /api/events/team/:teamId/draft - Get draft events by team ID for team members
eventsRouter.get(
  "/team/:teamId/draft",
  authenticateHandler,
  getDraftEventsByTeamIdHandler
);

// GET /api/events/:id - Get published event by ID
eventsRouter.get("/:id", getEventByIdHandler);

// GET /api/events/:id/draft - Get draft event by ID for team members
eventsRouter.get("/:id/draft", authenticateHandler, getDraftEventByIdHandler);

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
eventsRouter.post(
  "/",
  authenticateHandler,
  eventValidation,
  validateRequest,
  createEventHandler
);

// PATCH /api/events/:id - Update an event
// Requires team admin or event_manager role for the specific event
eventsRouter.patch(
  "/:id",
  authenticateHandler,
  eventUpdateValidation,
  validateRequest,
  updateEventHandler
);

// DELETE /api/events/:id - Delete an event
// Requires team admin or event_manager role for the specific event
eventsRouter.delete("/:id", authenticateHandler, deleteEventHandler);

// POST /api/events/:eventId/register - Register for an event
// Requires authentication
eventsRouter.post(
  "/:eventId/register",
  authenticateHandler,
  registerValidation,
  validateRequest,
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
