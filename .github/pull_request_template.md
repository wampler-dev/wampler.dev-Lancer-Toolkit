<!--
PROJECT: wampler.dev Lancer Toolkit
FILE: .github/pull_request_template.md
PURPOSE: Enforce structured, authority-aware contributions and prevent design drift.

AUTHORITY TIER: Tier 0 — Project Repository
GOVERNING SOURCES:
- docs/authority.md
- docs/conventions.md

LICENSE: MIT — see LICENSE file

CHANGE CONTROL:
- PRs that do not follow this structure are non-authoritative drafts

SCOPE NOTES:
- In scope: Contribution structure and required disclosures
- Out of scope: Workflow instructions (see CONTRIBUTING.md)

LAST REVIEWED: 2026-01-04
-->

Authority Tiers Used: Tier 0–4 (Tier 5 not used)

# Summary
Describe what this PR changes and why.

---

## One Axis of Change (Required)
Select exactly one:

- [ ] Docs (content or structure)
- [ ] Macro (behavior or implementation)
- [ ] Workflow (process documentation)
- [ ] Chore (repo hygiene, formatting, non-functional)

If multiple axes are needed, split into separate PRs.

---

## Governing Authority (Required)
Cite the authority tier(s) this change is governed by:

- Tier: ___
- Sources: ___

Examples:
- Tier 0 — `docs/authority.md`, `docs/conventions.md`
- Tier 3 — Foundry VTT v12 constraints (implementation-only)

---

## License & Headers (Required)
- [ ] Every file added/modified in this PR includes a compliant header (per `docs/conventions.md`)
- [ ] Every file added/modified declares `LICENSE: MIT — see LICENSE file` (or explicitly declares an override)

---

## Macro Audit (Required for Macro Changes Only)
- [ ] I added an entry to `docs/macro-audit.md` describing the change

---

## Scope & Safety
- [ ] This PR does not introduce destructive changes to Foundry documents or data models
- [ ] Toolkit extensions remain namespaced under `flags.lancer.*`

---

## Testing / Verification
Describe how you verified this change.

- [ ] Not applicable (docs-only)
- [ ] Manual test in Foundry v12 world
- [ ] Other: ___

---

## Notes for Reviewers (Optional)
Anything reviewers should pay attention to.
