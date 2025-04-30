import app from "../app";
import request from "supertest";
import endpointsTest from "../endpoints.json";

describe("Basic Express Server Endpoint Tests", () => {
  test("GET / should respond with a 200 status code and welcome message", async () => {
    const {
      body: { msg },
    } = await request(app).get("/").expect(200);
    expect(msg).toBe("Welcome to the Events Platform API!");
  });
  test("GET /api should return a comprehensive list of available endpoints", async () => {
    const {
      body: { endpoints },
    } = await request(app).get("/api").expect(200);
    expect(endpoints).toEqual(endpointsTest);
  });
});
