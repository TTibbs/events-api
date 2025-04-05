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
} from "../controllers/teams-controller";

const getTeamsHandler = getTeams as RequestHandler;
const getTeamByIdHandler = getTeamById as RequestHandler;
const createTeamHandler = createTeam as RequestHandler;
const updateTeamHandler = updateTeam as RequestHandler;
const deleteTeamHandler = deleteTeam as RequestHandler;

const getTeamMembersHandler = getTeamMembers as RequestHandler;
const getTeamMemberByIdHandler = getTeamMemberById as RequestHandler;
const getTeamMemberByUserIdHandler = getTeamMemberByUserId as RequestHandler;
const createTeamMemberHandler = createTeamMember as RequestHandler;

// Team member routes
teamsRouter.get("/members", getTeamMembersHandler);
teamsRouter.get("/members/user/:userId", getTeamMemberByUserIdHandler);
teamsRouter.get("/members/:id", getTeamMemberByIdHandler);
teamsRouter.post("/members", createTeamMemberHandler);

// Team routes
teamsRouter.get("/", getTeamsHandler);
teamsRouter.post("/", createTeamHandler);
teamsRouter.get("/:id", getTeamByIdHandler);
teamsRouter.patch("/:id", updateTeamHandler);
teamsRouter.delete("/:id", deleteTeamHandler);

export default teamsRouter;
