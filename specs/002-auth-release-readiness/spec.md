# Feature Specification: Auth release readiness

**Feature Branch**: `codex/fix-host-auth-schema-check`
**Created**: 2026-11-05
**Status**: Validated with isolated storage and mocked providers. Production repair awaits separate approval.
**Input**: Fix the unavailable host account check on bingo.string.sg; use Ponytail and Spec Kit; String ID is primary and direct Google sign-in is secondary.

## User Scenarios & Testing

### User Story 1 - Resume hosting (Priority: P1)

A host signs in primarily through String ID, with direct Google sign-in available as a secondary fallback, and opens their host workspace without losing existing games or ownership. A guest can continue playing without an account.

**Why this priority**: The reported failure prevents hosting.
**Independent Test**: Restore the missing release prerequisites in isolated data, then exercise signed-out, signed-in, create/share/play and cross-owner access journeys on desktop and mobile.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor and a ready service, **When** they choose Host a game, **Then** they see String ID as the primary action and Google as a secondary fallback without a service error.
2. **Given** a returning host, **When** the repair is applied, **Then** their original account, games and ownership are preserved.
3. **Given** a visitor without an account, **When** they play a public board, **Then** guest play remains available.
4. **Given** an unavailable account service, **When** a host checks their account, **Then** access fails closed with a retryable service error.
5. **Given** a legacy Google host, **When** they sign in using the same Google identity, **Then** they regain the same account and games even if their Google email changed.
6. **Given** an expired, invalid or unverified Google credential, **When** it is submitted, **Then** hosting is denied without creating an account.
7. **Given** a Google host with a saved draft, **When** sign-in completes or fails, **Then** the draft remains available; signing out clears only Bingo's Google session.

### User Story 2 - Reject an unready release (Priority: P2)

A maintainer receives a failed release check before new code reaches visitors when required storage changes have not been applied.

**Why this priority**: The current incident followed deployment before its required storage changes.
**Independent Test**: Attempt a release against isolated storage with pending migrations. Verify that it fails without changing records, then apply the changes and verify that it passes.

**Acceptance Scenarios**:

1. **Given** pending release prerequisites, **When** deployment builds, **Then** it fails and identifies the unapplied changes.
2. **Given** all release prerequisites are satisfied, **When** deployment builds, **Then** the normal application build runs.
3. **Given** a failing or stale journey check, **When** a pull request targets main, **Then** it cannot merge until the check passes against the latest base.

### Edge Cases

- Missing connection configuration, unavailable storage or failed prior changes block release.
- A legacy owner cannot be matched: repair stops instead of reassigning or deleting games.
- The existing request protection must continue to reject excess requests and fail closed on store failure.
- Local frontend builds remain possible without production credentials.

## Requirements

### Functional Requirements

- **FR-001**: Keep String ID as the primary host sign-in action, restore direct Google as a secondary fallback, and retain separate admin grants.
- **FR-002**: Preserve all existing account IDs, game IDs and game ownership during repair.
- **FR-003**: Keep public guest play independent from host authentication.
- **FR-004**: Reject deployment when required storage changes are pending or their status cannot be verified; checking MUST NOT apply changes automatically.
- **FR-005**: Retain request protection, server-side identity checks and cross-owner access rejection.
- **FR-006**: Validate against isolated data and obtain separate approval before production data changes or deployment.
- **FR-007**: Verify Google identity on the server and match returning accounts by the stable Google subject; never reassign an account through matching email alone.
- **FR-008**: Discard the Google credential after verification and retain no provider bearer token; issue an opaque Bingo session whose server stores only its hash, expiring no later than the Google credential and after at most one hour. Sign-out must revoke the selected Bingo session.
- **FR-009**: Protect Google sign-in and sign-out against cross-origin requests; Google sign-out must leave other String app sessions active.
- **FR-010**: Preserve drafts and expose a retryable sign-in error when Google cannot load or verification fails.

- **FR-011**: Require the GitHub Actions journey check on main and verify the exact release candidate in Preview before production release.

### Key Entities

- **Host account**: Existing member link and stable owner identity.
- **Game**: Existing board with a stable creator relationship.
- **Release prerequisite**: Required storage change and its completion state.
- **Bingo host session**: Opaque session hash, stable owner and expiry; never a stored Google credential.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Signed-out and signed-in hosting acceptance scenarios pass on desktop and mobile against isolated data.
- **SC-002**: Repair fixtures retain 100% of original account/game IDs and ownership relationships.
- **SC-003**: A missing migration, including the Google session migration, blocks the application build. A fully prepared release succeeds.
- **SC-004**: Existing guest play and access-control acceptance checks pass.

## Assumptions

- Google sign-in is explicitly reinstated by the user; guest access and separate admin policy remain authoritative.
- The existing storage changes are reused; one additive Bingo session table supports Google fallback without retaining provider tokens. Existing Google client credentials are reused.
- Production repair and a real signed-in browser pilot remain separately approved release work.
