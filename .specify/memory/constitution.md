# bingo-string Constitution

## Core Principles

### 1. Identity and authority

MUST validate identity on the server, use stable identifiers and explicit authorisation; failures MUST fail closed.

### 2. Preserve member data

MUST preserve existing accounts and ownership. Schema changes MUST be additive and deployed before readers; production data changes require separate approval.

### 3. Respect guest and privacy boundaries

MUST expose only needed fields, retain no provider bearer tokens, keep guest play independent from host login and never log credentials.

### 4. Test user journeys

MUST verify auth failure, cross-owner access and create/share/play journeys against isolated test data, plus existing check/build gates.

### 5. Use the existing architecture

MUST reuse the current stack and session contract; added infrastructure requires a demonstrated need.

## Delivery Constraints

Keep credentials out of version control. External provider setup and production migrations are rollout prerequisites, not claimed test results.

## Development Workflow

Maintain feature specifications, plans and task evidence. Run existing repository checks and scoped integration tests before review. Ship reviewable branches and draft PRs before merge/deploy.

## Governance

Amend through reviewed PRs, documenting rationale and compatibility. Use semantic versions for changes to these rules. AGENTS.md remains the operational source of truth where present.

**Version**: 1.0.0 | **Ratified**: 2026-10-25 | **Last Amended**: 2026-10-25
