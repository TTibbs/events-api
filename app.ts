import express, { Request, Response } from "express";
import cors from "cors";
import apiRouter from "./routes/api-router";
import {
  customErrorHandler,
  inputErrorHandler,
  psqlErrorHandler,
  serverErrorHandler,
} from "./errors";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.status(200).json({ message: "Hello World" });
});

app.use("/api", apiRouter);
app.use("/api/*", inputErrorHandler);
app.use(psqlErrorHandler);
app.use(customErrorHandler);
app.use(serverErrorHandler);

export default app;
