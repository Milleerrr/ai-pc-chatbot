import type { Database } from "../db/connection";

export type RequestContext = {
  db: Database;
};
