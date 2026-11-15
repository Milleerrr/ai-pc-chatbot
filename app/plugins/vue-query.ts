import { VueQueryPlugin } from "@tanstack/vue-query";
import { authClient } from "~/lib/auth-client";
import { createQueryClient } from "~/queries/client";

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = createQueryClient();

  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient });

  // Cached data belongs to one user, this is reset when the user changes so nothing leaks
  const session = authClient.useSession();
  watch(
    () => session.value.data?.user.id,
    (userId, previous) => {
      if (previous && userId !== previous) queryClient.clear();
    },
  );
});
