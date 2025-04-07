import db from "../db/connection";
import seed from "../db/seeds/seed";
import {
  users,
  teams,
  events,
  eventRegistrations,
  teamMembers,
  userSessions,
  tickets,
} from "../db/data/test-data/index";

// Clean DB state for e2e tests
export const setupDatabase = async () => {
  try {
    // Ensure DB is in a clean state
    await seed({
      users,
      teams,
      events,
      eventRegistrations,
      teamMembers,
      userSessions,
      tickets,
    });

    console.log("E2E test database seeded successfully");
  } catch (error) {
    console.error("Error during e2e test setup:", error);
    throw error;
  }
};

// Cleanup after all tests
export const teardownDatabase = async () => {
  try {
    // Make sure all pending queries complete
    await db.query("SELECT 1");

    // Close the connection properly
    await db.end();

    console.log("E2E test database connection closed successfully");
  } catch (error) {
    console.error("Error during database cleanup:", error);
    throw error;
  }
};
