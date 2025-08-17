import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../uploads");
const eventImagesDir = path.join(uploadsDir, "event-images");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(eventImagesDir)) {
  fs.mkdirSync(eventImagesDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, eventImagesDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `event-${uniqueSuffix}${ext}`);
  },
});

// File filter to only allow images
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (JPEG, PNG, GIF, WebP)"));
  }
};

// Configure multer
export const uploadEventImage = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Helper function to get the relative path for database storage
export const getRelativeImagePath = (filename: string): string => {
  return `/uploads/event-images/${filename}`;
};

// Helper function to get the full path for serving files
export const getFullImagePath = (filename: string): string => {
  return path.join(eventImagesDir, filename);
};

// Helper function to delete an image file
export const deleteImageFile = (filename: string): boolean => {
  try {
    const fullPath = getFullImagePath(filename);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error deleting image file:", error);
    return false;
  }
};

// Helper function to extract filename from path
export const extractFilenameFromPath = (filePath: string): string | null => {
  if (!filePath) return null;

  // If it's a URL, return null (we don't want to delete external URLs)
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    return null;
  }

  // Extract filename from path
  const filename = path.basename(filePath);
  return filename;
};
