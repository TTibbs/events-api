import { Router, RequestHandler } from "express";
const usersRouter = Router();
import {
  getUsers,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  createUser,
  getStaffMembers,
  getStaffMemberByUserId,
  createStaffMember,
} from "../controllers/users-controller";

const getUsersHandler = getUsers as RequestHandler;
const getUserByIdHandler = getUserById as RequestHandler;
const getUserByUsernameHandler = getUserByUsername as RequestHandler;
const getUserByEmailHandler = getUserByEmail as RequestHandler;
const createUserHandler = createUser as RequestHandler;
const getStaffMembersHandler = getStaffMembers as RequestHandler;
const getStaffMemberByUserIdHandler = getStaffMemberByUserId as RequestHandler;
const createStaffMemberHandler = createStaffMember as RequestHandler;

usersRouter.get("/", getUsersHandler);
usersRouter.get("/username/:username", getUserByUsernameHandler);
usersRouter.get("/email/:email", getUserByEmailHandler);

// Staff member routes - moved up before the generic /:id route
usersRouter.get("/staff", getStaffMembersHandler);
usersRouter.get("/staff/:userId", getStaffMemberByUserIdHandler);
usersRouter.post("/staff", createStaffMemberHandler);

// Generic ID route moved after more specific routes
usersRouter.get("/:id", getUserByIdHandler);
usersRouter.post("/", createUserHandler);

export default usersRouter;
