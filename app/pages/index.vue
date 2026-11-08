<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

const route = useRoute()
const session = authClient.useSession()

const user = computed(() => session.value.data?.user)
const isGuest = computed(() => !user.value || user.value.isAnonymous)

const handleSignIn = () => navigateTo('/login')

const handleSignOut = async () => {
  await authClient.signOut()
  // A deliberate sign-out shouldn't later show "your session expired".
  authClient.clearLastUsedLoginMethod()
  await navigateTo('/login')
}
</script>

<template>
  <PrototypeChatHost v-if="route.query.variant" />
  <div v-else class="flex flex-col gap-4 p-4">
    <p v-if="session.isPending">Loading…</p>

    <template v-else-if="isGuest">
      <h1>Hello guest</h1>
      <p>You're browsing as a guest. Sign in to keep your chat history.</p>
      <div>
        <UButton label="Sign in" color="neutral" variant="outline" @click="handleSignIn" />
      </div>
    </template>

    <template v-else>
      <h1>Hello {{ user?.name }}</h1>
      <div>
        <UButton label="Sign out" color="neutral" variant="outline" @click="handleSignOut" />
      </div>
    </template>

  </div>
</template>
