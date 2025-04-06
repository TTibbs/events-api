/**
 * Utility functions for database transactions
 */
import db from "../db/connection";
import { PoolClient } from "pg";

/**
 * Executes a callback within a database transaction
 * @param callback - Function containing database operations to execute within transaction
 * @returns The result of the callback function
 * @throws Will throw and rollback if any error occurs during the transaction
 */
export const executeTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Executes database operations with row-level locking to prevent race conditions
 * @param tableName - The table to lock rows in
 * @param whereClause - The WHERE clause to identify the rows to lock
 * @param params - Parameters for the WHERE clause
 * @param callback - Function containing database operations to execute with the lock
 * @returns The result of the callback function
 */
export const executeWithRowLock = async <T>(
  tableName: string,
  whereClause: string,
  params: any[],
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  return executeTransaction(async (client) => {
    // Lock the row(s) for update
    await client.query(
      `SELECT * FROM ${tableName} WHERE ${whereClause} FOR UPDATE`,
      params
    );

    // Execute the operations with the lock held
    return await callback(client);
  });
};
