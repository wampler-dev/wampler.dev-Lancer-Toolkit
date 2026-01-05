<!--
PROJECT: wampler.dev Lancer Toolkit
FILE: docs/authority.md
PURPOSE: Define the authoritative source hierarchy, licensing, and contribution authority governing all design, documentation, and macro work.

AUTHORITY TIER: Tier 0 — Project Repository
GOVERNING SOURCES:
- This repository

LICENSE: MIT — see LICENSE file

CHANGE CONTROL:
- Structural changes require explicit approval
- Conflicts must be resolved using the hierarchy defined herein

SCOPE NOTES:
- In scope: Authority resolution, licensing authority, contribution process authority, citation rules
- Out of scope: Workflow implementation details

LAST REVIEWED: 2026-01-04
-->

Authority Tiers Used: Tier 0

# Authority & Source Hierarchy
**Lancer Foundry Toolkit — Canonical Reference Order**

This document defines the **authoritative source hierarchy** for all design, workflow, and macro decisions within the **wampler.dev Lancer Toolkit** project.

Its purpose is to:
- Prevent ambiguity and design drift
- Provide deterministic conflict resolution
- Reduce reliance on human or AI working memory
- Enable long-lived, auditable system evolution

If multiple sources conflict, **higher tiers always override lower tiers**.

---

## Tier 0 — Project Repository (Supreme Authority)

**Repository:** `wampler-dev/wampler.dev-Lancer-Toolkit`

This repository is the **final and binding authority** for the project.

Authoritative artifacts include (but are not limited to):
- `docs/conventions.md`
- `docs/workflow.md`
- `docs/installation.md`
- `docs/macro-audit.md`
- Approved macro source files
- README and architecture documentation explicitly marked as final

**Rule:**  
If any external rule, tool behavior, or recommendation conflicts with this repository,  
**the repository always wins. No exceptions.**

---

## Tier 1 — Lancer Core Rules (System Canon)

**Source:** Massif Press — *Lancer Core Book* (latest official edition)

Authoritative for:
- Mission structure and pacing
- Downtime rules
- Combat flow and SitReps
- Narrative vs tactical boundaries
- NPC and PC distinctions
- Reserves, clocks, and escalation mechanics

**Rule:**  
Rules are followed as written unless an explicit, documented deviation exists in this repository.

---

## Tier 2 — Official Lancer Digital Tooling & Guidance

Includes:
- Comp/Con behavior and documentation
- Official errata and clarifications
- Massif Press-published examples and guidance

Authoritative for:
- Expected data models
- Standard Lancer organizational patterns
- Canonical interpretations of known edge cases

**Rule:**  
Used to inform structure and expectations,  
**never** to override repository conventions.

---

## Tier 3 — Foundry Virtual Tabletop Core (v12)

**Source:** Foundry Virtual Tabletop v12 core documentation and API behavior

Authoritative for:
- Document lifecycle (Scenes, Journals, Actors, Folders)
- Flags system mechanics
- Permissions and ownership
- Macro execution constraints
- Rendering and UI limits

**Rule:**  
Foundry constraints shape *implementation mechanics*,  
not *design intent*.

---

## Tier 4 — Lancer System for Foundry VTT

**Source:** The installed Lancer system module for Foundry VTT

Authoritative for:
- Actor and Item schemas (`system.*`)
- Built-in workflows and assumptions
- Existing flags and system behaviors

**Rule:**  
All project extensions must be **non-destructive** and namespaced under  
`flags.lancer.*`

---

## Tier 5 — Community Practices (Advisory Only)

Includes:
- Discord discussions
- Reddit posts
- Blog articles
- YouTube tutorials
- Third-party GM repositories

**Rule:**  
These sources are **inspirational only**.  
No community practice is adopted without:
1. Explicit approval, and
2. Documentation in this repository.

---

## Licensing Authority

**License:** MIT License  
**SPDX Identifier:** MIT

The MIT License governs all code and documentation in this repository unless a file explicitly declares otherwise.

**Rules:**
- Every file MUST declare its license via SPDX identifier in its header.
- The canonical license text lives in the repository root as `LICENSE`.
- Licensing does not override the authority hierarchy defined in this document.

Licensing questions are resolved at **Tier 0** (Project Repository).

---

## Contribution & Change Process Authority

All changes to this repository MUST enter through standardized, structured contribution mechanisms.

**Authoritative mechanisms include:**
- GitHub Pull Request templates
- GitHub Issue templates
- Repository-defined commit message standards
- CONTRIBUTING.md guidelines

**Rules:**
- Contributions that do not follow the standardized structure are considered non-authoritative drafts.
- Structural or behavioral changes MUST explicitly reference their governing authority tier.
- Macro changes MUST reference an entry in `docs/macro-audit.md`.
- One axis of change per pull request is mandatory.

These mechanisms exist to enforce the authority hierarchy defined in this document and to prevent design drift.

---

## Citation & Deviation Requirements

### Structural Decisions
All structural decisions must cite their governing authority tier.

Example:  
Packet state is authoritative via `flags.lancer.packetStatus`  
(Tier 0 — `docs/conventions.md`)

### Macros
All macros must include header comments stating:
- Governing authority tier
- Relevant document or rule
- Version (where applicable)

### Deviations
Any deviation from Tier 1–4 authorities must:
- Be explicitly justified
- Be logged in `docs/macro-audit.md`
- Identify the overridden authority

---

## Design Principle

This hierarchy exists to convert **memory into lookup**.

When ambiguity arises:
1. Consult this document
2. Resolve upward through the tiers
3. Default to Tier 0 (the repository)

This process is mandatory for both human and automated contributors.

---
