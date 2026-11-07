import { authClient } from "~/lib/auth-client";

// Visitors without a session are allowed through as guests; the guest user is
// created lazily by useEnsureSession(). The exception is a browser that has
// signed in to a real account before: its session expired, so ask it to sign in.
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === "/login") {
    return;
  }

  const { data: session } = await authClient.getSession();

  if (!session && authClient.getLastUsedLoginMethod()) {
    return navigateTo({ path: "/login", query: { redirect: to.fullPath, expired: "1" } });
  }
});
