import dotenv from "dotenv";

const ENV = process.env.NODE_ENV || "development";

// Load environment variables
dotenv.config({
  path: `${__dirname}/../.env.${ENV}`,
});

if (!process.env.JWT_SECRET) {
  throw new Error("JWT secret is required");
}

export const config = {
  // Database
  database: process.env.PGDATABASE,
  databaseUrl: process.env.DATABASE_URL,

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1h",
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || "7d",

  // Server
  port: process.env.PORT || 3000,

  // Environment
  isDevelopment: ENV === "development",
  isTest: ENV === "test",
  isProduction: ENV === "production",
};
