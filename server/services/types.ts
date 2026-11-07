import type { DbClient } from "../db/connection";

export type RequestContext = {
  /** Scoped to the signed-in user via withUser(), so RLS applies. */
  db: DbClient;
};
