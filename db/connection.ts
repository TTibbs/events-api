import { Pool, PoolConfig } from "pg";
const ENV = process.env.NODE_ENV || "development";

require("dotenv").config({
  path: `${__dirname}/../.env.${ENV}`,
});

if (!process.env.PGDATABASE && !process.env.DATABASE_URL) {
  throw new Error("PG database or database URL not set");
}

const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL as string,
  max: ENV === "production" ? 2 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

export default new Pool(config);
