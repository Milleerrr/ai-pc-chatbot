<script setup lang="ts">
import * as z from 'zod'
import type { FormSubmitEvent, AuthFormField } from '@nuxt/ui'
import { authClient } from '~/lib/auth-client'

const route = useRoute()
const toast = useToast()

const isSignUp = ref(false)

// Only follow same-site paths, never a full URL from the query string.
const redirect = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//') ? target : '/'
})

const showError = (message?: string) => {
  toast.add({
    title: isSignUp.value ? 'Sign up failed' : 'Login failed',
    description: message ?? 'Please try again',
    color: 'error'
  })
}

const handleGoogleLogin = async () => {
  const { error } = await authClient.signIn.social({ provider: 'google', callbackURL: redirect.value })

  if (error) showError(error.message)
}

const handleGuestLogin = async () => {
  const { error } = await authClient.signIn.anonymous()

  if (error) return showError(error.message)

  await navigateTo(redirect.value)
}

const credentialFields: AuthFormField[] = [{
  name: 'email',
  type: 'email',
  label: 'Email',
  placeholder: 'Enter your email',
  required: true
}, {
  name: 'password',
  label: 'Password',
  type: 'password',
  placeholder: 'Enter your password',
  required: true
}]

const nameField: AuthFormField = {
  name: 'name',
  type: 'text',
  label: 'Name',
  placeholder: 'Enter your name',
  required: true
}

const fields = computed(() => isSignUp.value ? [nameField, ...credentialFields] : credentialFields)

const providers = [{
  label: 'Google',
  icon: 'i-simple-icons-google',
  onClick: handleGoogleLogin
}, {
  label: 'Continue as guest',
  icon: 'i-lucide-user',
  onClick: handleGuestLogin
}]

const signInSchema = z.object({
  email: z.email('Invalid email'),
  password: z.string('Password is required').min(8, 'Must be at least 8 characters')
})

const signUpSchema = signInSchema.extend({
  name: z.string('Name is required').min(1, 'Name is required')
})

const schema = computed(() => isSignUp.value ? signUpSchema : signInSchema)

type Schema = z.output<typeof signInSchema> & { name?: string }

async function onEmailAndPasswordSubmit({ data }: FormSubmitEvent<Schema>) {
  const { error } = isSignUp.value
    ? await authClient.signUp.email({ name: data.name ?? '', email: data.email, password: data.password })
    : await authClient.signIn.email({ email: data.email, password: data.password })

  if (error) return showError(error.message)
  await navigateTo(redirect.value)
}
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-4 p-4">
    <UPageCard class="w-full max-w-md">
      <UAuthForm
        :key="isSignUp ? 'sign-up' : 'sign-in'"
        :schema="schema"
        :title="isSignUp ? 'Create account' : 'Login'"
        :description="isSignUp ? 'Enter your details to create an account.' : 'Enter your credentials to access your account.'"
        icon="i-lucide-user"
        :fields="fields"
        :providers="providers"
        :submit="{ label: isSignUp ? 'Sign up' : 'Continue' }"
        @submit="onEmailAndPasswordSubmit"
      >
        <template #footer>
          {{ isSignUp ? 'Already have an account?' : "Don't have an account?" }}
          <ULink class="text-primary font-medium" @click="isSignUp = !isSignUp">
            {{ isSignUp ? 'Sign in' : 'Sign up' }}
          </ULink>
        </template>
      </UAuthForm>
    </UPageCard>
  </div>
</template>
