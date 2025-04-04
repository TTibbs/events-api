import { Pool, PoolConfig } from "pg";
const ENV = process.env.NODE_ENV || "development";

require("dotenv").config({
  path: `${__dirname}/../.env.${ENV}`,
});

if (!process.env.PGDATABASE && !process.env.DATABASE_URL) {
  throw new Error("PG databse or database URL not set");
}

const config: PoolConfig = {
  connectionString: process.env.DATABASE_URL as string,
};

if (ENV === "production") {
  config.max = 2;
}

export default new Pool(config);
