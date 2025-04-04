import { Router } from "express";
const apiRouter = Router();
import usersRouter from "./users-router";
import authRouter from "./auth-router";
import endpoints from "../endpoints.json";

apiRouter.get("/", (req, res) => {
  res.status(200).send({ endpoints });
});

apiRouter.use("/users", usersRouter);
apiRouter.use("/auth", authRouter);

export default apiRouter;
