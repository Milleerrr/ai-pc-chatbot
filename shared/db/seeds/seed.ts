// shared/db/seeds/seed.ts
import { closeDatabase } from "../../../server/db/connection";
import { db } from "./client";
import * as seeders from "./index";

try {
  for (const seed of Object.values(seeders)) {
    if (typeof seed === "function") {
      await seed();
    }
  }
} finally {
  await closeDatabase(db);
}
