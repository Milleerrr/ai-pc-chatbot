import type { DbClient } from "../db/connection";
import type { UserContext } from "../db/with-user";

export type RequestContext = {
  /** Scoped to the signed-in user via withUser(), so RLS applies. */
  db: DbClient;
  /** Null when signed out. Writes to user-owned tables need it. */
  user: UserContext | null;
};
