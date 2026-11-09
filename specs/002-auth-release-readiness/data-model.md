# Data model

Reuse the two existing auth migrations unchanged and add only the Bingo fallback session table:

- `users.string_member_id`: nullable unique stable String member link; primary user IDs remain unchanged.
- `games.creator_id`: non-null stable owner reference, backfilled from existing owner email; game IDs remain unchanged. Existing compatibility trigger supports old inserts.
- `identity_link_audit`: records deterministic member linking.
- `rate_limit_buckets`: shared hashed client/scope counters with expiry.
- `_prisma_migrations`: readiness source; all local migrations must be finished with none pending or failed.

An unmatched legacy owner stops migration. No account merges, manual member mappings, deletions or data resets are part of this repair.

Existing `users.google_id` is the stable Google subject key; a new Google user has
a null String member link until String ID supplies its own verified subject proof.
New `bingo_host_sessions` holds a session hash (primary key), stable user foreign
key, expiry and creation time; expiry is indexed and bounded by one hour and the
Google credential. It contains neither a Google token nor a raw Bingo token.
The host-only `bingo_google_session` cookie holds the opaque Bingo token. An HttpOnly
`bingo_auth_provider=google` session cookie prevents expired fallback sessions
from silently switching to a different String ID account. Neither cookie changes
String ID's shared `string_session` contract.
