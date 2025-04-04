import { Router } from "express";
const usersRouter = Router();
import { getUsers } from "../controllers/users-controller";

usersRouter.get("/", getUsers);

export default usersRouter;
