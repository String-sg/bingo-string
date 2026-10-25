# Authentication and Ownership Contract

Bingo forwards only string_session to fixed https://id.string.sg/api/me. On 200 validate member.id/name/avatarUrl/email/googleAccountId and project minimal data;401 means signed out, other failures503. Link legacy owners by the verified Google subject, or explicit audited admin mapping; email collisions never silently reassign games. Mutations use trusted Origin plus owner checks. Guests can read/join/update only public games. Logout relays the clear-cookie header only on upstream success.

## Cross-repository dependency

String ID PR75 continuation must be deployed before Bingo enables String ID sign-in. Google and database configuration must be completed before provider rollout.
