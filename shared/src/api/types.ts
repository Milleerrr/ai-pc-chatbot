import { NodePgDatabase } from "drizzle-orm/node-postgres";

export type RequestContext = {
  db: NodePgDatabase;
};
