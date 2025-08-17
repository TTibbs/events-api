import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { uploadEventImage, getRelativeImagePath } from "../utils/fileUpload";

// Middleware to handle single image upload for events
export const handleEventImageUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  uploadEventImage.single("event_image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: "error",
          msg: "File too large. Maximum size is 5MB.",
        });
      }
      return res.status(400).json({
        status: "error",
        msg: "File upload error: " + err.message,
      });
    } else if (err) {
      return res.status(400).json({
        status: "error",
        msg: err.message,
      });
    }

    // If a file was uploaded, add the file path to the request body
    if (req.file) {
      req.body.event_img_url = getRelativeImagePath(req.file.filename);
    }

    next();
  });
};

// Middleware to handle optional image upload (allows both file upload and URL)
export const handleOptionalEventImageUpload = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  uploadEventImage.single("event_image")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          status: "error",
          msg: "File too large. Maximum size is 5MB.",
        });
      }
      return res.status(400).json({
        status: "error",
        msg: "File upload error: " + err.message,
      });
    } else if (err) {
      return res.status(400).json({
        status: "error",
        msg: err.message,
      });
    }

    // If a file was uploaded, add the file path to the request body
    if (req.file) {
      req.body.event_img_url = getRelativeImagePath(req.file.filename);
    }

    // If no file was uploaded but event_img_url is provided in body, keep it
    // This allows for both file uploads and URL inputs

    next();
  });
};
