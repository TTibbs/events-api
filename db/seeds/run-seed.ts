import {
  users,
  teams,
  events,
  categories,
  eventRegistrations,
  teamMembers,
  userSessions,
  tickets,
  stripePayments,
} from "../data/test-data/index";
import seed from "../seeds/seed";
import db from "../connection";

const devData = {
  users,
  teams,
  events,
  eventRegistrations,
  teamMembers,
  userSessions,
  tickets,
  stripePayments,
  categories,
};

const runSeed = async (): Promise<void> => {
  try {
    await seed(devData);
  } finally {
    db.end();
  }
};

runSeed();
