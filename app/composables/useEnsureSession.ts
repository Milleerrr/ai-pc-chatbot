import { authClient } from "~/lib/auth-client";

// Call before the first action that saves data:
//   if (!(await ensureSession())) return;
// Creates a guest user if there's no session, unless this browser has signed in
// to a real account before, in which case it sends them to /login instead.
export function useEnsureSession() {
  const route = useRoute();

  return async function ensureSession(): Promise<boolean> {
    const { data: session } = await authClient.getSession();

    if (session) return true;

    if (authClient.getLastUsedLoginMethod()) {
      await navigateTo({
        path: "/login",
        query: { redirect: route.fullPath, expired: "1" },
      });
      return false;
    }

    const { error } = await authClient.signIn.anonymous();

    if (error)
      throw new Error(error.message ?? "Could not start a guest session");

    return true;
  };
}
