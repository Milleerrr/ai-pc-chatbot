# Server state lives in TanStack Vue Query; reducers own only client state

ADR 0003 sent every client-side state change through reducers in Pinia stores, including data that is only a copy of the server's. Ticket #21 showed what that costs. The Chat list reducer rebuilt a query cache by hand: `loading | loaded | failed` unions, request ids to drop stale results, and hand-written list updates after create. Every later ticket that changes server data (rename, archive and delete, automatic titles, Brief updates, Continuation) would need its own copy of that logic. So data that mirrors the server now lives in `@tanstack/vue-query`, and reducers hold only state that exists nowhere on the server. Vue Query gives us caching, dedupe, invalidation, refetch on focus and retries. The team already uses TanStack Query (through `@trpc/react-query`) on a larger React app with no other state library.

## Where state goes

- **Server state** (Chats, Messages, the Build Brief, Allowance and token usage) goes in the Vue Query cache.
- **Client-only state** (composer lock, Brief badge, drawer, banners, Setup Form draft, confirmation steps) goes in reducers held in Pinia stores, per ADR 0003. A reducer may take query status or data as an input action, the same way it takes the chat hook's status. It never copies server data into its model.
- **Message streaming** stays with the AI SDK chat hook. Its initial Messages come from the Messages query. When a stream ends, the affected queries (that Chat's Messages, the Chat list for titles) are updated or invalidated.
- A mutation's pending or failed status comes from Vue Query. A reducer models a mutation's flow only when there is client-only state around it, such as a delete confirmation step.

## Shape

- `app/queries/<feature>.ts`: one key factory per feature with a single root key (`['chats', ...]`), plus query and mutation option factories. Plain functions over an injected API, unit-tested in the Node `unit` project against a real `QueryClient`.
- `app/composables/use<Feature>.ts`: wires the tRPC client in and calls `useQuery` / `useMutation`. Components still import only composables.
- `app/queries/client.ts` builds the `QueryClient`: 30s `staleTime`, no retry on 4xx tRPC errors, and the global invalidation hook below. `app/plugins/vue-query.ts` installs one client for the tab (SPA, so no dehydrate or hydrate) and clears the cache when the signed-in user changes.
- Mutations declare the keys they change in `meta: { invalidates: [...] }`, and a `MutationCache` `onSuccess` hook invalidates them. The mutation stays pending until the on-screen queries have refetched, so the UI never shows the old value after the spinner stops. This is the pattern TkDodo describes in "Automatic Query Invalidation after Mutations". It replaces a hand-written `invalidateQueries` in every `onSuccess` (platform has about 190 of those).
- A mutation adds its own `onSuccess` only for extras: navigation, or `setQueryData` when the response already carries what the next screen shows. For example, create seeds the new Chat's opener so the user lands on it with no fetch. When the server derives the result (read-only state, automatic titles), invalidate rather than guess.
- When several components show one mutation's state (the two "New chat" buttons), they read the mutation cache by `mutationKey` with `useMutationState`, not each component's own `useMutation` status.

## Considered options

- **Keep reducers for server state (ADR 0003 as written).** Rejected: each feature would reimplement caching and invalidation by hand.
- **Pinia Colada.** It's Pinia's own query layer and fits a Pinia app. Not chosen: it has a smaller ecosystem, and the team knows TanStack Query.
- **trpc-nuxt's `useQuery`.** It's built on `useAsyncData` and Nuxt's payload, aimed at SSR, and has a thinner mutation and invalidation story.
- **A tRPC adapter for Vue Query.** tRPC's official TanStack integration is React-only, and the Vue bindings are small community packages. We wrap the vanilla tRPC client in option factories instead. The data types those factories use come from `shared/types` (ADR 0005), and the server's services return the same types. `useChatsApi` returns tRPC results as `ChatsApi`, so it fails to typecheck if a procedure's output stops matching.

## Consequences

- #21's chats reducer, effects and store were removed. No Pinia store exists until the first client-only state (#22's composer lock). Pinia stays installed, and ADR 0003's spike findings still hold.
- Queries whose data is a `UIMessage` don't use `queryOptions()`. Its `DataTag` puts the data type into the key's type, and Vue Query's `DeepUnwrapRef` over the key recurses past TypeScript's limit (TS2589). Plain option objects work, and `getQueryData` calls state their type.
- `@tanstack/vue-query-devtools` is mounted in `app.vue`. It resolves to a stub outside development builds.
- The server remains the authority for every rule. The cache only mirrors it.
