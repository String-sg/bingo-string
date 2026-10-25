# Research Decisions

**Decision**: No new auth vendor or frontend framework. A verified Google subject provides an audited deterministic bridge to existing Google owners. Members using other methods can use the explicit mapping command or connect Google in String ID. Additive migration backfills before removing email-based ownership. Creation uses sessionStorage draft state and allowlisted internal host intent, retained until successful creation. Mobile uses full-width challenge fields; board remains preview.

**Rationale**: Meets user-approved boundaries and prevents account reassignment while retaining existing architecture.

**Alternatives considered**: app-specific Google auth (duplicates identity), email-only ownership (mutable), frontend bearer storage (unneeded), full framework replacement (unnecessary scope).

Sources: existing repository source; https://developers.google.com/identity/openid-connect/openid-connect and https://developers.google.com/identity/gsi/web/guides/verify-google-id-token.
