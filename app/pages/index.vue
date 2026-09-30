<script setup lang="ts">
import { authClient } from '~/lib/auth-client'

const session = authClient.useSession()

const handleSignOut = async () => {
  await authClient.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex flex-col gap-4 p-4">
    <h1>Hello {{ session.data?.user.name }}</h1>
    <pre class="text-sm">{{ JSON.stringify(session.data, null, 2) }}</pre>
    <div>
      <UButton label="Sign out" color="neutral" variant="outline" @click="handleSignOut" />
    </div>
  </div>
</template>
