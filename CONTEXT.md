# AI PC Chatbot

Users talk to a chatbot that interviews them until it understands their needs well enough to recommend computer parts to buy.

## Language

### People

**Guest**:
Someone using the app without having signed in. A Guest still owns their Chats, and keeps them when they sign in.
_Avoid_: Anonymous user, visitor

### Requirements

**Build**:
One computer a user wants parts for, such as "my gaming PC". It can be a whole new computer or an upgrade to one they already own. Every Chat belongs to exactly one Build.
_Avoid_: Project, order, rig

**Build Brief**:
The Build's record of what the interview has established about the user's needs, plus what is still unknown. It holds needs, constraints and preferences, never the assistant's choice of parts. It is the assistant's lasting memory of the Build and outlives any single Chat.
_Avoid_: Requirements profile, memory, notes, summary

**Existing Parts**:
Parts and peripherals the user already owns and will reuse in the Build. In an upgrade, these are the parts being kept.
_Avoid_: Current parts, old parts

**Ready**:
A Build Brief the user has confirmed as complete. Changing a required detail returns it to **In progress** until the user confirms it again.
_Avoid_: Complete, done, finished

**Confirmed / Assumed / Unknown / Not needed**:
How sure the Build Brief is of each detail. **Confirmed**: the user said it. **Assumed**: the assistant inferred it and still needs to check. **Unknown**: not yet established. **Not needed**: the user doesn't care, or it doesn't apply.
_Avoid_: Answered, inferred, known, guessed

**Open Question**:
Something the assistant still means to ask the user before the Build Brief is complete, including a contradiction it needs the user to resolve.

### Conversations

**Chat**:
One conversation thread between a user and the assistant, with a user-editable title.
_Avoid_: Conversation, thread, session

**Message**:
A single turn in a Chat, authored by either the user or the assistant.

**Archived Chat**:
A Chat hidden from the main list but still viewable and restorable. It is read-only until restored.
_Avoid_: Hidden chat

**Deleted Chat**:
A Chat the user has removed. It no longer appears anywhere in the app and cannot be restored by the user.
_Avoid_: Archived chat (that is a different action)

**Context Limit**:
The point at which everything the assistant must read to answer in a Chat (instructions, Build Brief and conversation) has grown to a fixed size allowance. The user is warned as it approaches, then asked to continue in a new Chat. A reply already underway is never cut off by it.

**Continuation**:
A new Chat started from a Chat that reached its Context Limit. It carries forward the Build Brief plus a short note on where the interview stood, and the assistant speaks first. The original Chat becomes read-only. The original stays read-only even if its Continuation is later deleted, but can be continued again.
_Avoid_: Moved chat, fork
