<script setup lang="ts">
import { chatPath, chatTitle } from '~/queries/chats'
import { authClient } from '~/lib/auth-client'

const { list, creating, createFailed, create } = useChats()
const chats = computed(() => list.data.value ?? [])
const route = useRoute()

const session = authClient.useSession()
const user = computed(() => session.value.data?.user)
const isGuest = computed(() => !user.value || user.value.isAnonymous)

const isActive = (chatId: string) => route.params.id === chatId

const handleSignIn = () => navigateTo('/login')

const handleSignOut = async () => {
  await authClient.signOut()
  // A deliberate sign-out shouldn't later show "your session expired".
  authClient.clearLastUsedLoginMethod()
  await navigateTo('/login')
}
</script>

<template>
  <UDashboardSidebar :ui="{ footer: 'border-t border-default' }">
    <template #header>
      <span class="font-semibold">PC Builder</span>
    </template>

    <div class="flex flex-col gap-3">
      <UButton
        icon="i-lucide-square-pen"
        label="New chat"
        block
        :loading="creating"
        @click="create"
      />
      <UAlert
        v-if="createFailed"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Couldn't start a Chat"
        description="Please try again."
      />

      <nav class="flex flex-col gap-0.5">
        <NuxtLink
          v-for="chat in chats"
          :key="chat.id"
          :to="chatPath(chat.id)"
          class="rounded-md px-2 py-1.5 hover:bg-elevated"
          :class="isActive(chat.id) ? 'bg-elevated' : ''"
        >
          <div class="truncate text-sm font-medium">{{ chatTitle(chat) }}</div>
          <div class="text-xs text-muted">{{ chat.createdAt.toLocaleString() }}</div>
        </NuxtLink>
      </nav>

      <p
        v-if="list.isSuccess.value && !chats.length"
        class="px-2 py-6 text-center text-sm text-muted"
      >
        No Chats yet.
      </p>
      <p v-else-if="list.isError.value" class="px-2 text-sm text-error">
        Couldn't load your Chats.
      </p>
    </div>

    <template #footer>
      <div v-if="session.isPending" />
      <div v-else-if="isGuest" class="flex w-full flex-col gap-1.5 text-xs">
        <span class="text-muted">Guest. Sign in to keep your Chats on your account.</span>
        <UButton label="Sign in" size="xs" color="neutral" variant="outline" block @click="handleSignIn" />
      </div>
      <div v-else class="flex w-full items-center gap-2 text-xs">
        <span class="flex-1 truncate text-muted">{{ user?.name }}</span>
        <UButton label="Sign out" size="xs" color="neutral" variant="ghost" @click="handleSignOut" />
      </div>
    </template>
  </UDashboardSidebar>
</template>
