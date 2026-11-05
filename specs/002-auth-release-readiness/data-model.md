# Data model

No new entities or schema changes. Reuse the two existing migrations unchanged:

- `users.string_member_id`: nullable unique stable String member link; primary user IDs remain unchanged.
- `games.creator_id`: non-null stable owner reference, backfilled from existing owner email; game IDs remain unchanged. Existing compatibility trigger supports old inserts.
- `identity_link_audit`: records deterministic member linking.
- `rate_limit_buckets`: shared hashed client/scope counters with expiry.
- `_prisma_migrations`: readiness source; all local migrations must be finished with none pending or failed.

An unmatched legacy owner stops migration. No account merges, manual member mappings, deletions or data resets are part of this repair.
