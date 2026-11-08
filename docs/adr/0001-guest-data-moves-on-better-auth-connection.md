# Guest data moves to the real account on Better Auth's own connection

When a Guest signs in, their Builds, Chats, Messages and Brief edits must change owner. `app_user` can't do it: `ownerPolicy` uses the same expression for `USING` and `WITH CHECK`, so no single `app.user_id` lets an UPDATE both see the Guest's row and write the new owner. So a service called from Better Auth's `onLinkAccount` hook does the move on `unrestrictedDb()`, the connection Better Auth already holds, with every statement filtering explicitly on the Guest id because RLS isn't guarding it.

`disableDeleteAnonymousUser` is set to `true`, and the same transaction deletes the Guest after the move. By default Better Auth deletes the Guest in a separate step after the hook, and every `userId` foreign key is `ON DELETE CASCADE`, so a failed move would be followed by a delete that wipes the Guest's data. One transaction makes move-and-delete atomic.

## Consequences

- This is the only app code besides Better Auth that uses `unrestrictedDb()`. It is reached through a service, never from a procedure.
- The move service must be updated whenever a new user-owned table is added, and `test/integration/rls.test.ts` should cover it.
