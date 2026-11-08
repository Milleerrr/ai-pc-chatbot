<script setup lang="ts">
import { submitSetup } from './state'
const props = defineProps<{ layout: 'card' | 'chips' | 'doc' }>()
const NS = 'Not sure'
const countries: Record<string, string> = { 'United States': 'USD', 'United Kingdom': 'GBP', Canada: 'CAD', Germany: 'EUR', Australia: 'AUD' }
const kind = ref('New build')
const use = ref('Gaming')
const country = ref('United States')
const currency = ref('USD')
const budget = ref('')
const budgetUnsure = ref(false)
const coverage = ref('Tower only')
const prefs = ref('')
watch(country, c => { currency.value = countries[c] ?? currency.value })
const kinds = ['New build', 'Upgrade', NS]
const uses = ['Gaming', 'Video editing', '3D / design', 'Programming', 'Office / school', 'Home server', NS]
const coverages = ['Tower only', 'Plus monitor', 'Plus peripherals', 'Everything', NS]
const submit = () => submitSetup({ kind: kind.value, use: use.value, country: country.value, currency: currency.value, budget: budgetUnsure.value ? NS : budget.value, coverage: coverage.value, prefs: prefs.value })
const skip = () => submitSetup(null)
</script>

<template>
  <form class="w-full" :class="layout === 'doc' ? 'space-y-3' : 'space-y-5'" @submit.prevent="submit">
    <div :class="layout === 'card' ? 'grid grid-cols-2 gap-4' : 'space-y-4'">
      <UFormField label="Is this a new PC or an upgrade?" :class="layout === 'card' ? 'col-span-2' : ''">
        <URadioGroup v-model="kind" :items="kinds" orientation="horizontal" :variant="layout === 'chips' ? 'card' : 'list'" size="sm" />
      </UFormField>
      <UFormField label="What will it mainly be used for?">
        <USelect v-model="use" :items="uses" class="w-full" />
      </UFormField>
      <UFormField label="Country">
        <USelect v-model="country" :items="Object.keys(countries)" class="w-full" />
      </UFormField>
      <UFormField label="Budget" :hint="budgetUnsure ? NS : currency">
        <div class="flex items-center gap-2">
          <UInput v-model="budget" type="number" placeholder="1500" :disabled="budgetUnsure" class="flex-1" />
          <USelect v-model="currency" :items="[...new Set(Object.values(countries))]" class="w-24" />
        </div>
        <UCheckbox v-model="budgetUnsure" label="Not sure yet" class="mt-1.5" />
      </UFormField>
      <UFormField label="What does the budget cover?">
        <USelect v-model="coverage" :items="coverages" class="w-full" />
      </UFormField>
      <UFormField label="Anything else? (optional)" :class="layout === 'card' ? 'col-span-2' : ''">
        <UTextarea v-model="prefs" placeholder="Brands you like, noise, size, looks…" :rows="2" class="w-full" />
      </UFormField>
    </div>
    <div class="flex items-center gap-2">
      <UButton type="submit" label="Start the interview" trailing-icon="i-lucide-arrow-right" />
      <UButton label="Skip" color="neutral" variant="ghost" @click="skip" />
    </div>
  </form>
</template>
