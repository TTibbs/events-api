import {
  users,
  events,
  eventRegistrations,
  staffMembers,
  userSessions,
} from "../data/test-data/index";
import seed from "../seeds/seed";
import db from "../connection";

const devData = {
  userData: users,
  eventData: events,
  eventRegistrationData: eventRegistrations,
  staffMemberData: staffMembers,
  userSessionData: userSessions,
};

const runSeed = async (): Promise<void> => {
  try {
    await seed(devData);
  } finally {
    db.end();
  }
};

runSeed();
