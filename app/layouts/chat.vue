<script setup lang="ts">
// Split screen: Chat list on the left, the page (open Chat) in the middle.
</script>

<template>
  <UDashboardGroup>
    <ChatSidebar />
    <slot />
  </UDashboardGroup>
</template>
