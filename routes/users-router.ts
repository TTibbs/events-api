import { Router, RequestHandler } from "express";
const usersRouter = Router();
import {
  getUsers,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  createUser,
  updateUserById,
  deleteUserById,
} from "../controllers/users-controller";
import { authenticate } from "../middlewares/auth-middleware";

const getUsersHandler = getUsers as RequestHandler;
const getUserByIdHandler = getUserById as RequestHandler;
const getUserByUsernameHandler = getUserByUsername as RequestHandler;
const getUserByEmailHandler = getUserByEmail as RequestHandler;
const createUserHandler = createUser as RequestHandler;
const updateUserByIdHandler = updateUserById as RequestHandler;
const deleteUserByIdHandler = deleteUserById as RequestHandler;
const authenticateHandler = authenticate as RequestHandler;

// Public endpoints - no authentication required
usersRouter.get("/", getUsersHandler);
usersRouter.get("/username/:username", getUserByUsernameHandler);
usersRouter.get("/email/:email", getUserByEmailHandler);
usersRouter.get("/:id", getUserByIdHandler);
usersRouter.post("/", createUserHandler);

// Protected endpoints - require authentication
usersRouter.patch("/:id", authenticateHandler, updateUserByIdHandler);
usersRouter.delete("/:id", authenticateHandler, deleteUserByIdHandler);

export default usersRouter;
