<!--
PROJECT: wampler.dev Lancer Toolkit
FILE: CONTRIBUTING.md
PURPOSE: Define the mandatory rules and expectations for contributing to this repository.

AUTHORITY TIER: Tier 0 — Project Repository
GOVERNING SOURCES:
- docs/authority.md
- docs/conventions.md

LICENSE: MIT — see LICENSE file

CHANGE CONTROL:
- This document defines binding contribution rules
- Conflicts are resolved via docs/authority.md

SCOPE NOTES:
- In scope: Contribution rules, structure, and expectations
- Out of scope: Implementation details and gameplay guidance

LAST REVIEWED: 2026-01-04
-->

# Contributing
**wampler.dev Lancer Toolkit — Contributor Contract**

Thank you for contributing.  
This repository is intentionally strict. That is a feature, not a bug.

All contributions—human or automated—are governed by the authority hierarchy defined in `docs/authority.md`.

---

## Core Principles (Non-Negotiable)

1. **Authority First**  
   Every change must cite the authority tier(s) that govern it.

2. **One Axis of Change**  
   Each Issue and Pull Request must address exactly one axis:
   - Docs
   - Macro
   - Workflow
   - Chore

3. **No Silent Drift**  
   Changes that bypass structure, headers, or audit requirements are non-authoritative.

4. **Repository Is Supreme**  
   If external advice conflicts with this repo, the repo wins.

---

## Before You Start

### Read These First
You are expected to be familiar with:
- `docs/authority.md`
- `docs/conventions.md`

If you have not read them, stop here.

---

## Contribution Entry Points

All changes MUST begin as one of the following:

- A **GitHub Issue** (using the provided templates), or
- A **Pull Request** that clearly references an existing Issue

Ad-hoc or unstructured contributions are not accepted.

---

## Branch Naming

Use clear, scoped branch names:

- `docs/<topic>-<short-desc>`
- `macro/<macro-name>-<short-desc>`
- `workflow/<topic>-<short-desc>`
- `chore/<short-desc>`

Examples:
- `docs/authority-license-header`
- `macro/packet-dashboard-refresh`
- `workflow/mission-packet-lifecycle`

---

## Pull Requests

All Pull Requests MUST:

- Use the PR template
- Declare **one axis of change**
- Cite governing authority tier(s)
- Confirm header and license compliance

### Macro Changes (Additional Requirements)
If your PR includes macro changes:
- The macro MUST include a compliant header
- The change MUST be logged in `docs/macro-audit.md`
- Behavior must be non-destructive and namespaced under `flags.lancer.*`

PRs that fail these requirements will be closed without merge.

---

## Headers & Licensing (Mandatory)

### Headers
Every file added or modified MUST include a compliant header as defined in `docs/conventions.md`.

**Rule:**  
Files without headers are considered **non-authoritative drafts**.

### Licensing
Every file MUST declare its license via SPDX identifier:

- `LICENSE: MIT — see LICENSE file`

The canonical license text lives in the repository root.

---

## Commit Messages

Commit messages should be clear and scoped.

Recommended format:

    <type>(<scope>): <summary>

    Refs: <authority or doc references>

Examples:

    docs(conventions): scope OSR prefix to Operation Solstice Rain

    Refs: docs/authority.md (Tier 0)

    macro(packet-dashboard): validate packetStatus enum before activation

    Refs: docs/authority.md (Tier 0); docs/macro-audit.md entry 2026-01-04

---

## AI-Assisted Contributions

AI assistance is allowed.

However:
- AI output is not authoritative by default
- You are responsible for ensuring compliance with:
  - Authority hierarchy
  - Conventions
  - Headers
  - Audit requirements

### Recommended Prompt Pattern
When using AI tools, include prompts such as:

    Given `docs/authority.md` as Tier 0, propose changes to `<file>`.
    Cite governing authority for each change.
    Output the full updated file with a compliant header.

---

## Rejections & Revisions

A contribution may be rejected if it:
- Violates the authority hierarchy
- Mixes multiple axes of change
- Omits required headers or license declarations
- Introduces undocumented behavioral changes
- Bypasses the audit log for macros

Rejection is procedural, not personal.

---

## Final Note

This project is designed to be:
- Auditable
- Deterministic
- Long-lived
- Resistant to memory loss and tooling drift

If that aligns with how you like to work, you’re in the right place.

---
