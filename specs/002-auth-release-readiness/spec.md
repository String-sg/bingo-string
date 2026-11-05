# Feature Specification: Auth release readiness

**Feature Branch**: `codex/fix-host-auth-schema-check`
**Created**: 2026-11-05
**Status**: Implementation validated; production repair awaiting separate approval
**Input**: Fix the unavailable host account check on bingo.string.sg; use Ponytail and Spec Kit.

## User Scenarios & Testing

### User Story 1 - Resume hosting (Priority: P1)

An existing String member signs in and opens their host workspace without losing existing games or ownership. A guest can continue playing without an account.

**Why this priority**: The reported failure prevents hosting.
**Independent Test**: Restore the missing release prerequisites in isolated data, then exercise signed-out, signed-in, create/share/play and cross-owner access journeys on desktop and mobile.

**Acceptance Scenarios**:

1. **Given** a signed-out visitor and a ready service, **When** they choose Host a game, **Then** they see the String ID sign-in prompt without a service error.
2. **Given** a returning host, **When** the repair is applied, **Then** their original account, games and ownership are preserved.
3. **Given** a visitor without an account, **When** they play a public board, **Then** guest play remains available.
4. **Given** an unavailable account service, **When** a host checks their account, **Then** access fails closed with a retryable service error.

### User Story 2 - Reject an unready release (Priority: P2)

A maintainer receives a failed release check before new code reaches visitors when required storage changes have not been applied.

**Why this priority**: The current incident followed deployment before its required storage changes.
**Independent Test**: Attempt a release against isolated storage missing the two auth changes; verify it fails without changing records, then apply the changes and verify it passes.

**Acceptance Scenarios**:

1. **Given** pending release prerequisites, **When** deployment builds, **Then** it fails and identifies the unapplied changes.
2. **Given** all release prerequisites are satisfied, **When** deployment builds, **Then** the normal application build runs.

### Edge Cases

- Missing connection configuration, unavailable storage or failed prior changes block release.
- A legacy owner cannot be matched: repair stops instead of reassigning or deleting games.
- The existing request protection must continue to reject excess requests and fail closed on store failure.
- Local frontend builds remain possible without production credentials.

## Requirements

### Functional Requirements

- **FR-001**: Restore the existing host sign-in path using the current identity contract, without changing host/admin entitlements.
- **FR-002**: Preserve all existing account IDs, game IDs and game ownership during repair.
- **FR-003**: Keep public guest play independent from host authentication.
- **FR-004**: Reject deployment when required storage changes are pending or their status cannot be verified; checking MUST NOT apply changes automatically.
- **FR-005**: Retain request protection, server-side identity checks and cross-owner access rejection.
- **FR-006**: Validate against isolated data and obtain separate approval before production data changes or deployment.

### Key Entities

- **Host account**: Existing member link and stable owner identity.
- **Game**: Existing board with a stable creator relationship.
- **Release prerequisite**: Required storage change and its completion state.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Signed-out and signed-in hosting acceptance scenarios pass on desktop and mobile against isolated data.
- **SC-002**: Repair fixtures retain 100% of original account/game IDs and ownership relationships.
- **SC-003**: Both missing-prerequisite release attempts fail before application build; a fully prepared release succeeds.
- **SC-004**: Existing guest play and access-control acceptance checks pass.

## Assumptions

- Existing String ID hosting, guest access and separate admin policy remain authoritative.
- The existing reviewed storage changes are reused; no new identity provider or migration is needed.
- Production repair and a real signed-in browser pilot remain separately approved release work.
