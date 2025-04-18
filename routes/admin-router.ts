import { Router, RequestHandler } from "express";
import { authMiddleware } from "../middlewares/auth-middleware";
import {
  getAdminDashboard,
  promoteUserById,
} from "../controllers/admin-controller";

const adminRouter = Router();

const getAdminDashboardHandler = getAdminDashboard as RequestHandler;
const promoteUserHandler = promoteUserById as RequestHandler;
const authenticateHandler = authMiddleware.isAuthenticated as RequestHandler;
// Protected endpoints - require authentication
adminRouter.get("/dashboard", authenticateHandler, getAdminDashboardHandler);
adminRouter.patch("/users/:id", authenticateHandler, promoteUserHandler);

export default adminRouter;
