# wampler.dev-Lancer-Toolkit
My personal collection of Lancer Foundry VTT macros.

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

These flags are treated as the single source of truth.
Name prefixes, dashboards, and reports are derived from flags — never the reverse.

⸻

Naming Conventions (Non-Negotiable)
	•	Mission prefix: OSR
	•	Mission format:
OSR M# — Mission Name
	•	Packet journals:
OSR M# B## — Name
OSR M# C## — Name
OSR M# D## — Name
	•	No emojis baked into entity names
	•	Icons may be added/removed dynamically by macros
	•	All macros must be:
	•	Idempotent
	•	Audit-safe
	•	Re-runnable without side effects

⸻

Folder Structure (Expected)

This toolkit assumes a mission folder structure created by the
Lancer Mission Journal Generator v9 (CLEAN).
OSR M# — Mission Name
├─ Beats
├─ Combats
├─ Downtime
└─ Meta
   ├─ Packet Dashboard
   ├─ Packet Audit Report
   ├─ Threat Console
   ├─ Mission Overview
   └─ Mission Debrief
All dashboards, audits, and meta journals reuse the existing Meta folder.
Macros will not create duplicate Meta folders.

⸻

Repository Layout
macros/
├─ core/        Packet state management (status, current, reset)
├─ session/     Session automation (One-Button Session Loop)
├─ dashboard/   Packet Dashboard generation
├─ audit/       Packet Audit & Repair tooling
├─ scenes/      Packet ↔ Scene binding
├─ player/      Player-facing views
├─ threat/      Threat tracking and control
└─ _wip/        Experimental or unapproved macros
Only macros outside _wip/ are considered approved/final.

⸻

Installation
	1.	Create or open a Foundry world using:
	•	Foundry VTT v12+
	•	Lancer system
	2.	Run Lancer Mission Journal Generator v9 (CLEAN) to establish folders
	3.	Copy macros from this repository into Foundry’s Macro Directory
	4.	Place commonly used macros on the hotbar
	5.	Follow the documented workflow in docs/installation.md

⸻

Workflow Overview

Typical GM loop:
	1.	Set or verify Current Packet
	2.	Run Packet → Mark Active
	3.	Play the scene
	4.	Run Session Loop — One Button
	•	Marks packet completed
	•	Advances Threat (optional)
	•	Activates next packet
	5.	Use Packet Dashboard to track mission state
	6.	Use Packet Audit & Repair if anything looks off

All steps are safe to repeat.

⸻

Design Principles
	•	Explicit over implicit
	•	Flags over names
	•	Repair beats failure
	•	Recovery is always possible
	•	GM time is more valuable than automation cleverness

If a macro cannot explain its actions clearly, it does not belong here.

⸻

License

This project is licensed under the MIT License.
See the LICENSE file for details.

⸻

Status

This repository is authoritative for the OSR Foundry / Lancer Toolkit.
	•	Macros are extracted from live, tested Foundry worlds
	•	Versions are locked only after GM validation
	•	Experimental work lives in _wip/

⸻

Acknowledgments

Built for GMs who want structure without friction
and automation without loss of control.