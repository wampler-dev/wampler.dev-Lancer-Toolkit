# OSR Foundry / Lancer Toolkit

A packet-based mission control toolkit for **Foundry VTT (v12+)** using the **Lancer RPG system**.

This repository contains **authoritative, GM-facing macros** developed to support structured Lancer play using *Operation Solstice Rain*–style packetized missions, with a strong emphasis on:

- Idempotence
- Auditability
- Clear state transitions
- Minimal manual bookkeeping
- Safe recovery from mistakes

The code here is intended to be **copied directly into Foundry macros** or bundled into a private or public module.

---

## Core Concepts

### Packet-Based Mission Architecture

A **Packet** is a single discrete unit of play:
- **B##** — Beats (narrative / skill challenges)
- **C##** — Combats
- **D##** — Downtime

Each packet is represented by a **Journal Entry** and progresses through explicit states.

### Canonical Packet Flags

All packet state is stored on the journal entry using the Lancer system flag scope:

```text
flags.lancer.packetStatus       upcoming | active | completed
flags.lancer.currentPacket     boolean
flags.lancer.packetSceneId     Scene UUID
flags.lancer.packetActorFolderId Actor Folder ID