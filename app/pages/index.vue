<script setup lang="ts">
definePageMeta({ layout: 'chat' })

const { creating, create } = useChats()
</script>

<template>
  <UDashboardPanel id="chat-start">
    <template #body>
      <div class="grid flex-1 place-items-center">
        <div class="max-w-sm space-y-3 text-center">
          <h1 class="text-xl font-semibold">Plan your next PC</h1>
          <p class="text-sm text-muted">
            Start a Chat and the assistant will ask what you need, one question at a time.
          </p>
          <UButton
            icon="i-lucide-square-pen"
            label="New chat"
            :loading="creating"
            @click="create"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
