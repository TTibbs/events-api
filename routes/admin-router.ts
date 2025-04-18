import {
  Router,
  RequestHandler,
  Request,
  Response,
  NextFunction,
} from "express";
import { authMiddleware } from "../middlewares/auth-middleware";
import { getAdminDashboard } from "../controllers/admin-controller";

const adminRouter = Router();

const getAdminDashboardHandler = getAdminDashboard as RequestHandler;
const authenticateHandler = authMiddleware.isAuthenticated as RequestHandler;

// Protected endpoints - require authentication
adminRouter.get("/dashboard", authenticateHandler, getAdminDashboardHandler);

export default adminRouter;
