# Data Model

User gains unique nullable stringMemberId; email/googleId become nullable. Game gains required creatorId backfilled through existing creatorEmail, with legacy creatorEmail retained nullable. IdentityLinkAudit records approved linking method and stable IDs. Guest game sessions remain separate and photos are locally namespaced by game+session.

## Validation and Transitions

Identity links are unique and never silently rebound. Failed or expired proof never authenticates. Existing data is backfilled before new code reads it. Session failure does not imply empty game data.
