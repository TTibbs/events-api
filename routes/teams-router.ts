import { Router, RequestHandler } from "express";
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
} from "../controllers/teams-controller";
import { authenticate } from "../middlewares/auth-middleware";

const getTeamsHandler = getTeams as RequestHandler;
const getTeamByIdHandler = getTeamById as RequestHandler;
const createTeamHandler = createTeam as RequestHandler;
const updateTeamHandler = updateTeam as RequestHandler;
const deleteTeamHandler = deleteTeam as RequestHandler;

const getTeamMembersHandler = getTeamMembers as RequestHandler;
const getTeamMemberByIdHandler = getTeamMemberById as RequestHandler;
const getTeamMemberByUserIdHandler = getTeamMemberByUserId as RequestHandler;
const createTeamMemberHandler = createTeamMember as RequestHandler;
const getTeamMembersByTeamIdHandler = getTeamMembersByTeamId as RequestHandler;

const authenticateHandler = authenticate as RequestHandler;

// Team member routes - require authentication
teamsRouter.get("/members", authenticateHandler, getTeamMembersHandler);
teamsRouter.get(
  "/members/user/:userId",
  authenticateHandler,
  getTeamMemberByUserIdHandler
);
teamsRouter.get("/members/:id", authenticateHandler, getTeamMemberByIdHandler);
teamsRouter.post("/members", authenticateHandler, createTeamMemberHandler);

// Team routes
teamsRouter.get("/", getTeamsHandler);
teamsRouter.post("/", authenticateHandler, createTeamHandler);
teamsRouter.get("/:id", getTeamByIdHandler);
teamsRouter.get("/:id/members", getTeamMembersByTeamIdHandler);
teamsRouter.patch("/:id", authenticateHandler, updateTeamHandler);
teamsRouter.delete("/:id", authenticateHandler, deleteTeamHandler);

export default teamsRouter;
