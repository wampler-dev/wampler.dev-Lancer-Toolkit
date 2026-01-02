# Gameplay Workflow

This document describes the expected GM loop during play when using OSR packet-based missions.

The system assumes that **exactly one packet is both Current and Active at any time**.

## Typical Session Flow

1. Open the **Packet Dashboard**.
2. Verify that exactly one packet is marked **Current** and **Active**.
   - If this invariant is violated, resolve it before proceeding.
3. Play the scene associated with the active packet.
4. At the end of the scene or beat, run **Session Loop — One Button** to advance packet state.
5. Review Threat, upcoming packets, and dashboard state before continuing.

## Safety & Recovery

All OSR macros are **idempotent** and safe to re-run.

If packet state becomes unclear or inconsistent:
- Re-run the Packet Dashboard build.
- Use Packet Audit & Repair to restore a valid state before continuing play.
