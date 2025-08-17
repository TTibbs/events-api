import { Router, Request, Response } from "express";
const apiRouter = Router();
import usersRouter from "./users-router";
import authRouter from "./auth-router";
import teamsRouter from "./teams-router";
import ticketsRouter from "./tickets-router";
import eventsRouter from "./events-router";
import endpoints from "../endpoints.json";
import adminRouter from "./admin-router";
import stripeRouter from "./stripe-router";
import healthRouter from "./health-router";

apiRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).send({ endpoints });
});

apiRouter.use("/health", healthRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/teams", teamsRouter);
apiRouter.use("/tickets", ticketsRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/stripe", stripeRouter);

export default apiRouter;
