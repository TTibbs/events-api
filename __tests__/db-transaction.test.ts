import {
  executeTransaction,
  executeWithRowLock,
} from "../utils/db-transaction";
import db from "../db/connection";

// Mock the database connection
jest.mock("../db/connection", () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

describe("Database Transaction Utility Functions", () => {
  let mockClient: any;
  let mockRelease: jest.Mock;

  beforeEach(() => {
    mockRelease = jest.fn();
    mockClient = {
      query: jest.fn(),
      release: mockRelease,
    };
    (db.connect as jest.Mock).mockReset();
    (db.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  describe("executeTransaction", () => {
    test("should execute a successful transaction", async () => {
      const expectedResult = { id: 1, name: "Test Record" };
      const callback = jest.fn().mockResolvedValue(expectedResult);

      mockClient.query.mockImplementation(async (query: string) => {
        if (query === "BEGIN") return { rows: [] };
        if (query === "COMMIT") return { rows: [] };
        return { rows: [expectedResult] };
      });

      const result = await executeTransaction(callback);

      expect(db.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockRelease).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    test("should rollback transaction on error", async () => {
      const error = new Error("Test error");
      const callback = jest.fn().mockRejectedValue(error);

      await expect(executeTransaction(callback)).rejects.toThrow(error);

      expect(db.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockRelease).toHaveBeenCalled();
    });

    test("should release client even if callback throws", async () => {
      const error = new Error("Test error");
      const callback = jest.fn().mockImplementation(() => {
        throw error;
      });

      await expect(executeTransaction(callback)).rejects.toThrow(error);

      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe("executeWithRowLock", () => {
    test("should execute operations with row-level locking", async () => {
      const tableName = "users";
      const whereClause = "id = $1";
      const params = [123];
      const expectedResult = { id: 123, name: "User Name" };
      const callback = jest.fn().mockResolvedValue(expectedResult);

      // Mock the transaction behavior
      mockClient.query.mockImplementation(async (query: string) => {
        if (query === "BEGIN") return { rows: [] };
        if (query === "COMMIT") return { rows: [] };
        if (query.includes("FOR UPDATE")) return { rows: [{ id: 123 }] };
        return { rows: [expectedResult] };
      });

      const result = await executeWithRowLock(
        tableName,
        whereClause,
        params,
        callback
      );

      expect(db.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith(
        `SELECT * FROM ${tableName} WHERE ${whereClause} FOR UPDATE`,
        params
      );
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockRelease).toHaveBeenCalled();
      expect(result).toEqual(expectedResult);
    });

    test("should rollback on error during row lock operation", async () => {
      const tableName = "users";
      const whereClause = "id = $1";
      const params = [123];
      const error = new Error("Lock error");
      const callback = jest.fn();

      // Force an error during the FOR UPDATE query
      mockClient.query.mockImplementation(async (query: string) => {
        if (query === "BEGIN") return { rows: [] };
        if (query.includes("FOR UPDATE")) throw error;
        return { rows: [] };
      });

      await expect(
        executeWithRowLock(tableName, whereClause, params, callback)
      ).rejects.toThrow(error);

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(callback).not.toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    test("should rollback on error during callback execution", async () => {
      const tableName = "users";
      const whereClause = "id = $1";
      const params = [123];
      const error = new Error("Callback error");
      const callback = jest.fn().mockRejectedValue(error);

      mockClient.query.mockImplementation(async (query: string) => {
        if (query === "BEGIN") return { rows: [] };
        if (query === "COMMIT") return { rows: [] };
        if (query === "ROLLBACK") return { rows: [] };
        if (query.includes("FOR UPDATE")) return { rows: [{ id: 123 }] };
        return { rows: [] };
      });

      await expect(
        executeWithRowLock(tableName, whereClause, params, callback)
      ).rejects.toThrow(error);

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith(
        `SELECT * FROM ${tableName} WHERE ${whereClause} FOR UPDATE`,
        params
      );
      expect(callback).toHaveBeenCalledWith(mockClient);
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockRelease).toHaveBeenCalled();
    });
  });
});
