import { getDb } from "../db/connection";
import { createAuth, type Auth } from "./create-auth";

let auth: Auth | undefined;

export function getAuth() {
  if (!auth) {
    const { auth: config } = useRuntimeConfig();
    auth = createAuth({ db: getDb(), ...config });
  }

  return auth;
}
