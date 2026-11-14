# Client state changes go through reducers held in Pinia stores

Client-side state transitions are pure reducers, `(state, action) => state`, in `app/reducers/`. Pages and components dispatch actions instead of deciding transitions inline or calling tRPC from event handlers. Each reducer's state lives in a Pinia setup store (`@pinia/nuxt`, stores in `app/stores/`), which owns the single `dispatch` that runs the reducer. Effects (tRPC calls, navigation) are plain async functions in `app/effects/` that take their dependencies and a `dispatch` callback and report results back as actions.

The reasons are testing and robustness. Chat v1's screen has many interacting states: the composer lock, the Brief badge (charging, power-up, glow until opened), the Setup Form, the Allowance and Context Limit banners, Archived and read-only Chats, and failed-reply recovery. Written inline in components, those rules can only be tested through a browser, and component and browser tests are out for v1. As pure functions they run in the `unit` Vitest project, which is plain Node with no Nuxt environment, so a reducer can't import Vue, Pinia, auto-imports or tRPC. That constraint keeps them independently testable.

Pinia is there for what reducers alone don't give us. The screen needs one state shared across the sidebar, header badge, Chat and meter, and one set per open Chat. A Pinia store provides that, shows actions in the Vue devtools timeline, and is what a Nuxt developer expects. Pinia on its own would not meet the goal: its state is writable from anywhere and has no enforced write path (no strict mode), so the reducer is what keeps writes to one place. This is the Elm-style pattern for Pinia that community write-ups describe (alexop.dev, "How to Write Better Pinia Stores with the Elm Pattern" and its API-calls follow-up). That is a blog pattern, not official Pinia guidance.

The AI SDK chat hook keeps owning Message streaming state (the list of Messages and the stream's status). Reducers don't duplicate it. They own what surrounds it and may take the hook's status as an input action, for example `streamStarted` and `streamClosed` driving the composer lock and badge charging.

## Shape

- `app/reducers/<feature>.ts`: the model type, the action union and `update(model, action)`. No Vue, Pinia, tRPC or I/O, and nothing that reads the clock or randomness; those arrive on the action.
- `app/effects/<feature>.ts`: async functions `(deps, dispatch, ...args)`. They dispatch `started`, then `succeeded` or `failed`. Dependencies such as the tRPC client are passed in, so tests can fake them.
- `app/stores/<feature>.ts`: a Pinia setup store holding `model` as a `ref`, `dispatch` (the only caller of `update`) and the actions that run effects. It returns all state, as Pinia requires.
- `app/composables/use<Feature>.ts`: the only thing components import. It exposes `readonly` state and the actions, never the raw store.

## Rules for reducers

- Model status as a union (for example `idle | charging | poweredUp | glowing`), not independent booleans, so impossible combinations can't be represented.
- Async actions carry a request id, and the reducer ignores results for a request that is no longer current. Stop and Retry depend on this.
- The server remains the authority for limits. A reducer may mirror a rule for the UI but never replaces the server's check.
- A component with only local, presentational state (an open menu, a hovered row) may use plain refs. If a rule would need a test to be trusted, it belongs in a reducer.

## Consequences

- New dependencies: `pinia` and `@pinia/nuxt` (with `@vue/devtools-api`, a required peer of Pinia).
- Reducers and effects are unit-tested in `test/unit/`. Store wiring is tested in the same project with `setActivePinia(createPinia())`; files under test import `ref` and `defineStore` explicitly, because auto-imports don't exist outside Nuxt.
- Pinia's docs warn that returning read-only state from a setup store breaks devtools and plugins, so the read-only view lives in the wrapper composable, not in the store. This was not verified when the ADR was written, and the first UI ticket includes a spike to check it (devtools still shows actions, the store is testable in Node). If it fails, the fallback is convention plus review: components import only the composable.
- Pinia's `ssr: false` behaviour isn't covered in its docs. The app is a SPA, so per-request store concerns should not apply, but this is an assumption to confirm in the same spike.
- This doesn't change the server rules: data access still goes through a service and a tRPC procedure.
- Server-state caching libraries (Pinia Colada, TanStack Query) are not part of v1.
