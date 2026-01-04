<!--
PROJECT: wampler.dev Lancer Toolkit
FILE: docs/conventions.md
PURPOSE: Define canonical naming, organization, flag authority, and header standards for all repository work.

AUTHORITY TIER: Tier 0 — Project Repository
GOVERNING SOURCES:
- docs/authority.md

LICENSE: MIT — see LICENSE file

CHANGE CONTROL:
- Changes to these conventions are structural and require explicit approval
- Conflicts are resolved via docs/authority.md

SCOPE NOTES:
- In scope: Naming, organization, flags, headers, repository hygiene conventions
- Out of scope: Step-by-step workflows (see docs/workflow.md)

LAST REVIEWED: 2026-01-04
-->

# Conventions
**wampler.dev Lancer Toolkit — Canonical Project Conventions**

This document defines the canonical conventions for repository organization and Foundry VTT content structure used by this toolkit.

If any ambiguity arises, consult `docs/authority.md` and resolve conflicts using the authority hierarchy defined there.

---

## Repository Hygiene

### `__MACOSX` Artifacts
`__MACOSX` artifacts are ignored permanently. They must not be committed, referenced, or treated as meaningful project content.

---

## Mission Naming (General Rule)

Mission naming MUST be explicit about the campaign or module it belongs to.

### General Mission Format
Unless otherwise specified, missions use the format:

- `<Campaign Prefix> M# — Mission Name`

Where:
- `<Campaign Prefix>` is a short, stable identifier for the campaign or module
- `M#` is the mission number within that campaign

**Examples:**
- `SR M1 — First Contact`
- `HB M4 — Echoes of the Blacksite`
- `CW M2 — Ashfall`

---

## Operation Solstice Rain (OSR) — Special Case

### OSR Prefix Scope
The prefix:

- `OSR`

is **reserved exclusively** for the official Lancer campaign  
**Operation Solstice Rain**.

**Rule:**
- `OSR` MUST NOT be used for homebrew, side campaigns, or other official modules.
- Any mission using the `OSR` prefix is assumed to be part of *Operation Solstice Rain* unless explicitly documented otherwise.

### OSR Mission Format
For Operation Solstice Rain only:

- `OSR M# — Mission Name`

**Examples:**
- `OSR M1 — First Contact`
- `OSR M3 — The Long Retreat`

---

## Packet Journals

Packet journals are organized by type and numbered with two digits:

- `B##` = Beats
- `C##` = Combats
- `D##` = Downtimes

**Examples:**
- `B01 — Briefing`
- `C03 — Ambush at the Relay`
- `D02 — Repairs and Debrief`

---

## Flag Authority (Foundry VTT)

### Authoritative Packet Flags
These flags are authoritative and MUST be treated as the source of truth for packet state and bindings:

- `flags.lancer.packetStatus` ∈ `upcoming` | `active` | `completed`
- `flags.lancer.currentPacket` (boolean)
- `flags.lancer.packetSceneId`
- `flags.lancer.packetActorFolderId`

**Rules:**
- These flags are authoritative even if UI state or naming diverges.
- If a macro detects conflicting state, it should warn and prefer authoritative flags.
- No other field may be treated as the authoritative packet state unless explicitly defined in Tier 0 documentation.

### Namespacing Rule
All toolkit extensions must be **non-destructive** and namespaced under:

- `flags.lancer.*`

---

## Mission Folder Organization

### Meta Journals Location
Meta journals (Dashboard, Audit, Player View, Threat, etc.) live in the mission’s **Meta** folder.

**Rule:**
- Mission operational content (packets, scenes, actors) must not be mixed into Meta.
- Meta is reserved for cross-packet or mission-wide controls, views, and indices.

---

## Standard Headers (Mandatory)

All files in this repository MUST include a compliant header.

**Rule:**
- Files without headers are considered **non-authoritative drafts**.

Headers exist to prevent design drift and to ensure contributors (human or automated) can determine authority, scope, and change requirements at a glance.

### Documentation Headers (`.md`)
Place this HTML comment header at the top of every documentation file:

```text
<!--
PROJECT: wampler.dev Lancer Toolkit
FILE: <path/filename>
PURPOSE: <One-sentence description>

AUTHORITY TIER: Tier 0 — Project Repository
GOVERNING SOURCES:
- docs/authority.md
- <other Tier 0 docs, as needed>

LICENSE: MIT — see LICENSE file

CHANGE CONTROL:
- <brief change control constraints>

SCOPE NOTES:
- In scope: <explicit>
- Out of scope: <explicit>

LAST REVIEWED: YYYY-MM-DD
--
