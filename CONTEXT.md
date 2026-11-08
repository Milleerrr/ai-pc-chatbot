# AI PC Chatbot

Users talk to a chatbot that interviews them until it understands their needs well enough to recommend computer parts to buy.

## Language

### People

**Guest**:
Someone using the app without having signed in. A Guest still owns their Chats, and keeps them when they sign in.
_Avoid_: Anonymous user, visitor

### Requirements

**Build**:
One computer a user wants parts for, such as "my gaming PC". Every Chat belongs to exactly one Build.
_Avoid_: Project, order, rig

**Build Brief**:
The Build's record of what the interview has established about the user's needs, plus what is still unknown. It is the assistant's lasting memory of the Build and outlives any single Chat.
_Avoid_: Requirements profile, memory, notes, summary

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
The point at which a Chat holds too much conversation to continue. The user is then asked to continue in a new Chat.

**Continuation**:
A new Chat started from a Chat that reached its Context Limit. It carries forward what has been learned so far, and the original Chat becomes read-only.
_Avoid_: Moved chat, fork
