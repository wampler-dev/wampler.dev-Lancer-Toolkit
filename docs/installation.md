Authority Tiers Used: Tier 0

# Installation & Initial Setup

Follow this document to set up a packet-based Lancer mission using the OSR toolkit.

This toolkit assumes a **clean, deterministic mission structure**. Do not skip steps or reorder them.

## Prerequisites

- Foundry VTT **v12+**
- Lancer system (latest stable)
- **Lancer Mission Journal Generator v9**, run in a **clean state**
  - The generated mission folders and journals must not be manually renamed or modified before setup.

## Setup Steps

1. Create or open a Lancer world.
2. Run the Mission Journal Generator to create the mission and its folder structure.
3. Create packet journals using the established conventions (e.g. `B##`, `C##`, `D##`).
4. Paste the **approved OSR macros** into Foundry:
   - Macros should be placed in a dedicated macro folder.
   - Do not rename macros after pasting.
5. Set the initial packet and run **Packet Dashboard — Build/Refresh**.

## Recovery & Safety

All OSR macros are designed to be **idempotent** and **recoverable**.

If the mission state becomes inconsistent, run **Packet Audit & Repair**.  
This operation is safe to execute multiple times and will not damage valid state.
