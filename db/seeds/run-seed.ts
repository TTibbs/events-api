import { devData } from "../data/dev-data/index";
import seed from "../seeds/seed";
import db from "../connection";

const runSeed = async (): Promise<void> => {
  try {
    await seed(devData);
  } finally {
    db.end();
  }
};

runSeed();
