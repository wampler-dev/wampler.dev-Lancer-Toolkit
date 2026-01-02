# OSR Macro Audit & Review Ledger

This document tracks technical review findings, recommendations, and resolution status
for GM-facing macros in the OSR Foundry / Lancer Toolkit.

The purpose of this ledger is to preserve **auditability**, **design intent**, and
**institutional memory** as the macro suite evolves.

Only high-signal findings are recorded here. Trivial style nits are intentionally excluded.

---

## Packet Dashboard — Build/Refresh (v8.2)

**Category:** Dashboard / Derived State  
**Role:** Aggregates and presents packet, threat, and mission state  
**Mutation:** None (read-only, derived view)

### Findings

#### 1. Invariant violations are not surfaced to the GM
- **Finding:**  
  The dashboard silently renders state even when core invariants are violated
  (e.g. multiple `Current` packets or multiple `Active` packets).
- **Impact:**  
  GMs may unknowingly continue play in an invalid state, undermining the guarantees
  described in `docs/conventions.md`.
- **Recommendation:**  
  Detect invariant violations and display a prominent warning block on the dashboard,
  including a direct link to **Packet Audit & Repair**.
- **Status:** Open

---

#### 2. Default macro link names may not resolve
- **Finding:**  
  `DEFAULT_MACROS` values do not consistently match actual macro names present in the repo
  (punctuation, arrows, version labels differ).
- **Impact:**  
  Dashboard action links may silently fail unless manually corrected per mission.
- **Recommendation:**  
  Either:
  - Align defaults exactly with canonical macro names, or
  - Implement a lightweight macro-name resolver that tolerates punctuation/version variance.
- **Status:** Open

---

#### 3. Progress bar inner element may be visually invisible
- **Finding:**  
  The progress bar’s inner `<div>` has width and height but no guaranteed background color.
- **Impact:**  
  On some Foundry themes, progress appears empty or broken.
- **Recommendation:**  
  Apply a theme-safe background (e.g. CSS variables) to ensure visibility.
- **Status:** Open

---

#### 4. UUID link labels are not hardened against edge characters
- **Finding:**  
  Journal names are used verbatim as UUID link labels.
- **Impact:**  
  Rare, but malformed names containing `}` could break link syntax.
- **Recommendation:**  
  Sanitize or normalize UUID link labels before embedding.
- **Status:** Deferred (low risk)

---

### Summary

- The macro is **architecturally sound**, idempotent, and correctly avoids mutating state.
- All findings are **non-blocking**, but addressing them will significantly improve
  robustness, GM trust, and alignment with documented guarantees.
