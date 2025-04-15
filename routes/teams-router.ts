import {
  Router,
  RequestHandler,
  Request,
  Response,
  NextFunction,
} from "express";
import { body, validationResult } from "express-validator";
const teamsRouter = Router();
import {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  getTeamMemberById,
  getTeamMemberByUserId,
  createTeamMember,
  getTeamMembersByTeamId,
  getTeamByName,
} from "../controllers/teams-controller";
import { authenticate } from "../middlewares/auth-middleware";

// Validation middleware
const validateRequest = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
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

// Team validation
const teamValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Team name is required")
    .isLength({ min: 3, max: 100 })
    .withMessage("Team name must be between 3 and 100 characters"),
];

// Team member validation
const teamMemberValidation = [
  body("team_id").notEmpty().withMessage("Team ID is required").isNumeric(),
  body("role")
    .notEmpty()
    .withMessage("Role is required")
    .isIn(["admin", "event_manager", "team_member"])
    .withMessage("Role must be admin, event_manager, or team_member"),
];

// Type assertions for controllers
const getTeamsHandler = getTeams as RequestHandler;
const getTeamByIdHandler = getTeamById as RequestHandler;
const getTeamByNameHandler = getTeamByName as RequestHandler;
const createTeamHandler = createTeam as RequestHandler;
const updateTeamHandler = updateTeam as RequestHandler;
const deleteTeamHandler = deleteTeam as RequestHandler;

const getTeamMembersHandler = getTeamMembers as RequestHandler;
const getTeamMemberByIdHandler = getTeamMemberById as RequestHandler;
const getTeamMemberByUserIdHandler = getTeamMemberByUserId as RequestHandler;
const createTeamMemberHandler = createTeamMember as RequestHandler;
const getTeamMembersByTeamIdHandler = getTeamMembersByTeamId as RequestHandler;

const authenticateHandler = authenticate as RequestHandler;

// Team basic routes
teamsRouter.get("/", getTeamsHandler);
teamsRouter.post(
  "/",
  authenticateHandler,
  teamValidation,
  validateRequest,
  createTeamHandler
);

// Team member routes - require authentication
// These must come before the :id routes to avoid conflict
teamsRouter.get("/members", authenticateHandler, getTeamMembersHandler);
// The more specific route must come before the parameter route
teamsRouter.get(
  "/members/user/:userId",
  authenticateHandler,
  getTeamMemberByUserIdHandler
);
teamsRouter.get("/members/:id", authenticateHandler, getTeamMemberByIdHandler);
teamsRouter.post(
  "/members",
  authenticateHandler,
  teamMemberValidation,
  validateRequest,
  createTeamMemberHandler
);

// Team name lookup - must come before :id route to avoid conflict
teamsRouter.get("/name/:name", getTeamByNameHandler);

// Team ID-based routes
teamsRouter.get("/:id", getTeamByIdHandler);
teamsRouter.get("/:id/members", getTeamMembersByTeamIdHandler);
teamsRouter.patch(
  "/:id",
  authenticateHandler,
  teamValidation,
  validateRequest,
  updateTeamHandler
);
teamsRouter.delete("/:id", authenticateHandler, deleteTeamHandler);

export default teamsRouter;
