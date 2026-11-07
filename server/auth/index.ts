import { unrestrictedDb } from "../db/connection";
import { createAuth, type Auth } from "./create-auth";

let auth: Auth | undefined;

export function getAuth() {
  if (!auth) {
    const { auth: config } = useRuntimeConfig();
    auth = createAuth({ db: unrestrictedDb(), ...config });
  }

  return auth;
}
