<!--
PROJECT: wampler.dev Lancer Toolkit
FILE: docs/design/combat-start.md
PURPOSE: Define the combat start boundary (Stage 0 validation + Combat Commit) with a Tier 1 freeze and Tier 2 implementation design contracts.

AUTHORITY TIER: Tier 1 (Frozen) → Tier 2 (Implementation Design)
GOVERNING SOURCES:
- docs/authority.md
- docs/conventions.md
- docs/installation.md
- docs/workflow.md
- docs/macro-audit.md

LICENSE: MIT — see LICENSE file

CHANGE CONTROL:
- This document is Tier 1 (Frozen) and Tier 2 (Design). It must not contradict Tier 0.
- Tier 1 Frozen sections require explicit amendment to change.
- Tier 2 sections may evolve, but must remain compatible with Tier 0 and Tier 1 Frozen constraints.

SCOPE NOTES:
- In scope: Combat start boundary only (Stage 0 validator, freshness, digests, Combat Commit marker).
- Out of scope: NPC spawning, initiative automation, effects, encounter scaling, combat end, UI polish.

LAST REVIEWED: 2026-01-05
-->

# Combat Start — Validation & Commit

**Authority Tier:** Tier 1 (Frozen) → Tier 2 (Implementation Design)

---

## Scope

This document defines the **combat start boundary** for the Lancer Foundry Toolkit:
the rules, contracts, and minimal state required to transition a packet from
narrative readiness into active combat **safely, deterministically, and auditably**.

**In scope:**
- Stage 0 validation (read-only)
- The single orchestration primitive: **Combat Commit**
- Beat combat capability designation
- Validation freshness enforcement without packet-state pollution
- Digest strategy for anti-stale guarantees
- Combat Commit marker schema and idempotency

**Out of scope:**
- NPC spawning, initiative, effects, scaling, waves
- UI polish beyond contract-level integration
- End-of-combat semantics (explicitly deferred)

---

## Tier 0 Conformance Check (Required)

The following Tier 0 authoritative documents have been **explicitly reviewed**
for compatibility with this design. In the event of any conflict, **Tier 0 prevails**.

- [x] `docs/authority.md`
- [x] `docs/conventions.md`
- [x] `docs/installation.md`
- [x] `docs/workflow.md`
- [x] `docs/macro-audit.md`

**Notes:**
- Conflicts identified: none
- Required clarifications added: BLOCKED remediation path acknowledged
- Tier 0 remediation paths acknowledged where applicable: yes

---

## Lifecycle Overview

Validate (Stage 0) → Commit (Combat Commit) → Spawn / Run Combat → Cleanup  
→ (Future) Combat End

- Validation determines eligibility and readiness.
- Combat Commit performs a single atomic transition.
- All structural or mechanical changes occur **after** commit.

---

## Tier 1 Freeze

The following are **frozen**. Tier 2 must implement them as written; changes require
explicit amendment.

- Validation and orchestration are separated (validator is read-only; commit is minimal).
- Beats are not combat by default; Beats must explicitly opt in to be combat-capable.
- Combat start must be atomic, auditable, and forgiving (no partial state; loud failures).
- Combat Commit performs no structural or mechanical changes beyond a commit marker.

---

## Stage 0 Validator (Read-Only)

### Purpose

Determine whether combat may begin for a packet **without mutating state**.

### Inputs (minimum)

- Intended packet journal entry (unambiguous scope)
- Read access to:
  - packet flags
  - bound scene
  - bound actor folder
- Permission checks for downstream lifecycle actions

### Output Shape

```ts
type Stage0Verdict = "READY" | "READY_WITH_WARNINGS" | "BLOCKED";

type Finding = {
  severity: "HARD" | "SOFT";
  code: string;
  message: string;
  details?: unknown;
};

type Stage0Result = {
  verdict: Stage0Verdict;
  packetId: string;
  packetName: string;
  findings: Finding[];
  validatedAssumptions: {
    combatCapable: boolean;
    sceneId?: string;
    actorFolderId?: string;
    permissionsOk: boolean;
  };
  producedAt: number; // epoch ms
};

