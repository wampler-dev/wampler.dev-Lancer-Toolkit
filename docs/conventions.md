# System Conventions & Guarantees

This toolkit enforces a small set of strict invariants.  
All macros are written to assume these rules and to restore them when violated.

## Core Invariants

- Exactly **one** packet must be marked **Current**.
- At most **one** packet may be marked **Active**.
- `packetStatus` flags are the **sole source of truth** for packet state.
- Journal name icons and visual indicators are **derived state**, never authoritative.
- All macros are **idempotent** and safe to re-run at any time.

## Enforcement & Recovery

Transient violations of these invariants are expected during play and automation.

When inconsistencies are detected, **Packet Audit & Repair** will:
- Recompute derived state
- Restore a valid packet configuration
- Preserve authoritative data wherever possible

Running audit or repair operations multiple times is safe and will not damage valid state.
