import { Request, Response, NextFunction } from "express";

interface CustomErrorInterface extends Error {
  status?: number;
  msg?: string;
  code?: string;
}

// Custom error class for application-specific errors
export class CustomError extends Error implements CustomErrorInterface {
  status: number;
  msg: string;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.status = statusCode;
    this.msg = message;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const inputErrorHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(404).send({ msg: "Invalid input" });
  const err: CustomErrorInterface = new Error(
    "Invalid input"
  ) as CustomErrorInterface;
  err.status = 404;
  next(err);
};

export const psqlErrorHandler = (
  err: CustomErrorInterface,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.code === "23502" || err.code === "22P02" || err.code === "23503") {
    res.status(400).send({ msg: "Bad request" });
  } else next(err);
};

export const customErrorHandler = (
  err: CustomErrorInterface,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.status && err.msg) {
    res.status(err.status).send({ status: "error", msg: err.msg });
  } else next(err);
};

export const serverErrorHandler = (
  err: CustomErrorInterface,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(err, "<<<<<< ------ Unhandled error");
  res.status(500).send({ msg: "Internal server error" });
};
