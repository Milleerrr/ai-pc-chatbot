import type { DbClient } from "../db/connection";
import type { UserContext } from "../db/with-user";

export type RequestContext = {
  db: DbClient;
  user: UserContext | null;
};
