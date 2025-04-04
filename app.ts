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
  res.status(200).json({ msg: "Welcome to the Promptius API!" });
});

app.use("/api", apiRouter);

// Place the error handlers after all routes
app.use(psqlErrorHandler);
app.use(customErrorHandler);
app.use(serverErrorHandler);

// Add a 404 handler for routes that don't exist
app.use((req: Request, res: Response) => {
  res.status(404).json({ msg: "Route not found" });
});

export default app;
