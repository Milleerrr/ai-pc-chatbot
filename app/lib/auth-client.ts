import { createAuthClient } from "better-auth/vue";
import {
  anonymousClient,
  lastLoginMethodClient,
} from "better-auth/client/plugins";
import { dashClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  plugins: [anonymousClient(), lastLoginMethodClient(), dashClient()],
});
