<script setup lang="ts">
const { $api } = useNuxtApp();

const { data, pending, error } = await $api.hello.useQuery({ text: "world" });


</script>

<template>
  <div v-if="pending">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>
      {{ data?.greeting }}
    </div>
</template>
  