# System Conventions & Guarantees

This toolkit enforces the following invariants:

- Exactly one packet may be Current.
- At most one packet may be Active.
- packetStatus is the source of truth.
- Journal name icons are derived, never authoritative.
- All macros must be safe to re-run.

If these invariants are violated, Packet Audit & Repair will restore them.
