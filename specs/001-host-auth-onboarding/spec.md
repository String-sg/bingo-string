# Feature Specification: String ID host authentication and first-game onboarding

**Feature Branch**: `codex/string-id-host-onboarding`

**Created**: 2026-10-25

**Status**: Implemented; draft PR review

**Input**: User approved the reviewed plan, Google sign-in in String ID, all members may host, guests may play, host onboarding and preservation of existing games.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Host with String ID (Priority: P1)

Any String member can host; returning Google hosts retain their games.

**Why this priority**: Required for the agreed host-to-guest experience.

**Independent Test**: Exercise the acceptance scenario with isolated accounts and data.

**Acceptance Scenarios**:

1. **Given** a signed-in member or existing game owner, **When** they open My Games, **Then** their own games remain accessible and other owners cannot mutate them.

### User Story 2 - Create and share a first game (Priority: P2)

Hosts follow setup, challenges and review to a persistent share screen.

**Why this priority**: Required for the agreed host-to-guest experience.

**Independent Test**: Exercise the acceptance scenario with isolated accounts and data.

**Acceptance Scenarios**:

1. **Given** a new host, **When** they create a 3x3 or 5x5 game, **Then** exactly one game is created and its link can be copied.

### User Story 3 - Play without signing in (Priority: P2)

Guests open a shared link and play independently of host authentication.

**Why this priority**: Required for the agreed host-to-guest experience.

**Independent Test**: Exercise the acceptance scenario with isolated accounts and data.

**Acceptance Scenarios**:

1. **Given** a public shared game, **When** a signed-out guest joins, **Then** the saved board size is respected and their own progress/photos are isolated.

### Edge Cases

Expired/replayed login, provider outage, email/link conflicts, missing email, concurrent creation, private/deleted game, malformed input, partial failure, keyboard-only use and small screens must have explicit outcomes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST authenticate hosts through String ID; keep guest public-game play independent of login.
- **FR-002**: System MUST authorise host mutations and results by stable local user ownership; keep explicit Bingo admin grants separate from String ID roles.
- **FR-003**: System MUST preserve all existing games and backfill stable owner IDs; link legacy identities only through an audited approved mapping.
- **FR-004**: System MUST validate shared sessions server-side; return signed-out and upstream-unavailable states distinctly, expose only minimal identity and never store bearer credentials in browser storage.
- **FR-005**: System MUST provide setup, challenges, review and persistent share steps, with starter prompts and editable drafts preserved through sign-in, reload, errors and board-size changes.
- **FR-006**: System MUST require all 9 or 24 nonblank prompts, validate CSV data rows by board size and show inline errors.
- **FR-007**: System MUST use the saved board size consistently for create, read, edit and play; reject private/deleted games for joining or progress.
- **FR-008**: System MUST render untrusted strings as text, bound guest input and progress, and isolate local photos per game and player session.
- **FR-009**: System MUST provide labelled readable mobile controls, keyboard-operated cells/dialogs, persistent host identity and accurate loading/empty/error states.
- **FR-010**: System MUST provide reliable API cold start, additive migrations, Origin checks, logout forwarding and automated acceptance coverage.

### Key Entities

- Member identity: stable account and provider link with explicit proof.
- Session: expiring authenticated context; guest progress remains separate.
- Game ownership: stable relationship preserved across sign-in methods.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every stated acceptance scenario passes in automated isolated tests.
- **SC-002**: No unauthorised account linking, host write or private-game participation succeeds in negative tests.
- **SC-003**: Existing member and game identifiers remain unchanged after migration fixtures.

## Assumptions

Only hosts are onboarded. No site-wide admin reporting is added. Real MOE account and production configuration checks are release prerequisites; deployment is outside this approval. Completed specs remain a maintained contract.
