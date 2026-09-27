<script setup lang="ts">
const { $api } = useNuxtApp();

const { data, pending, error } = await $api.getUsers.useQuery();

</script>

<template>
  <div v-if="pending">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else v-for="user in data" :key="user.id">
      {{ user.firstName }} {{ user.lastName }} - {{ user.email }}
    </div>
</template>
  