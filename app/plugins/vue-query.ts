import { VueQueryPlugin } from "@tanstack/vue-query";
import { authClient } from "~/lib/auth-client";
import { createQueryClient } from "~/queries/client";

// Server state cache (ADR 0004). The app is a SPA, so there is no
// dehydrate/hydrate step: one client for the life of the tab.
export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = createQueryClient();

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });

  // Cached data belongs to one user. Drop it when the user changes (sign out,
  // a different sign-in, a Guest linking to an account) so nothing leaks.
  const session = authClient.useSession();
  watch(
    () => session.value.data?.user.id,
    (userId, previous) => {
      if (previous && userId !== previous) queryClient.clear();
    },
  );
});
