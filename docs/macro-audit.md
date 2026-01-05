Authority Tiers Used: Tier 0

# Macro Audit Log (OSR Toolkit)

This file is the persistent, audit-friendly suggestion and status log for each macro in the repo.

Legend:
- ✅ Captured: Code has been pasted into the chat and is available for review/audit.
- 🟡 Known missing: Macro is expected/mentioned but code not yet captured.
- 🔴 Not yet captured: Present in repo tree but not yet pasted here.
- 🧭 Notes: File naming mismatches, version drift, or follow-ups.

---

## Inventory

### macros/dashboard
- ✅ `Packet Dashboard Build&Refresh (v8.2).js`
  - Notes: We have a v8.2 “Meta-aware” dashboard macro body captured.

### macros/packets
- ✅ `Packet Advance Nextjs`
  - 🧭 Notes: Filename appears to be missing a period before `js`. Macro body captured (“Advance Next Packet → Opened …”).
- ✅ `Packet Assign Scene (v1.2)js`
  - 🧭 Notes: Filename appears to be missing a period before `js`. Macro body captured.
- ✅ `Packet Audit&Repair (v2.1).js`
- ✅ `Packet Create Scene from Template (v1).js`
- ✅ `Packet Create&Assign Actor Folder (v1).js`
- ✅ `Packet Mark Active.js`
- ✅ `Packet Mark Completed.js`
- ✅ `Packet Mark Next Links.js`
- ✅ `Packet Mark Upcoming.js`
- ✅ `Packet Meta Cleanup Utility.js`
- 🔴 `Packet Open Bound Scene (v1).js`
  - 🧭 Notes: User stated they do not currently have this macro; remaking later is acceptable.
- ✅ `Packet Open Current (v2).js`
- ✅ `Packet Open Player View (v2).js`
- ✅ `Packet Refresh Status Icons.js`
- ✅ `Packet Reset All.js`
- ✅ `Packet Set Current.js`
- ✅ `Packet Spawn Encounter from Templates (v1).js`
- ✅ `Packet Undo Spawn (v1).js`

### macros/threat
- 🔴 `Threat Advance&Reduce (v2).js`
- ✅ `Threat Control Panel (v2).js`
- 🔴 `Threat Ensure Console.js`

### macros/qol
- 🔴 `GM Turn Checklist (v1).js`
- 🔴 `Lancer Mission Journal Generator (v9).js`
- 🔴 `One Button Session Loop (v4.1).js`
  - 🧭 Notes: A “Session Loop — One Button (v4.1)” macro body was pasted, but repo filename differs. Confirm whether identical.

### macros/mission
- 🔴 `Mission Rest Wizard.js`
- 🔴 `Mission Session Summary Generator.js`

---

## Suggestions Log (per macro)

> This section will accumulate recommendations, edge cases, and improvements per macro as we audit each one.

### Packet Dashboard Build&Refresh (v8.2)
- (pending) Add: guardrails for missing Mission Overview/Debrief/Threat/Quest journals to show “missing” labels consistently.
- (pending) Add: optional “repair UUID labels” pass (similar to Audit) if you frequently rename journals.

### Packet Audit&Repair (v2.1)
- (pending) Verify: `repairsApplied` increments once for “Sync icons” even if it updates many journals; consider counting per-journal for clarity.

### Packet Spawn / Undo Spawn
- (pending) Add: “dry run” mode to show counts before creating/deleting.
- (pending) Add: optional “also delete packet actor folder if empty” on Undo (guarded + confirm).

(Additional per-macro notes will be appended as we proceed.)

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

---

## Packet — Audit & Repair (v2.1)

**Category:** Packets / Invariants / Recovery  
**Role:** Detects and repairs packet invariant violations; optionally writes an HTML report  
**Mutation:** Yes (flags + optional journal name icon sync)

### Findings

#### 1. Repairs-applied count is inaccurate for icon sync
- **Finding:** `repairsApplied++` is incremented once for the entire icon sync pass, even if no names change, and does not reflect how many journals were actually updated.
- **Impact:** Report metrics become misleading; reduces trust in audit output.
- **Recommendation:** Make `syncIconToStatus()` return whether it changed the name and increment repairs by actual change count.
- **Status:** Open

---

#### 2. “Missing packetStatus” stat cannot be computed correctly post-repair
- **Finding:** Post-repair recompute uses `status = flag ?? "upcoming"`, so “missing” can never be true and the stat trends to zero even if flags are absent.
- **Impact:** Report loses the ability to distinguish “defaulted upcoming” from “explicitly flagged upcoming.”
- **Recommendation:** Track `hasStatusFlag` (flag present) separately from effective status.
- **Status:** Open

---

#### 3. Invariant enforcement defaults may not match documented guarantees
- **Finding:** `enforceSingleActive` is not enabled by default even though toolkit docs state “at most one packet may be Active.”
- **Impact:** Users may run audit expecting invariants to be enforced, but Active conflicts may remain unless they toggle the option.
- **Recommendation:** Enable `enforceSingleActive` by default, or explicitly document that Active enforcement is optional.
- **Status:** Open

---

#### 4. “Keep first” rule should be described as deterministic
- **Finding:** UI text says “keep first,” but the selection rule is actually “first by sorted packet name,” which is deterministic.
- **Impact:** Minor ambiguity during recovery operations.
- **Recommendation:** Update UI copy to “keep earliest by packet sort order.”
- **Status:** Deferred (polish)

---

## Set Current Packet (v2)

**Category:** Packets / Invariants  
**Role:** Sets `currentPacket` within a mission scope and clears other current flags  
**Mutation:** Yes (`flags.lancer.currentPacket`)

### Findings

#### 1. Open-window “topmost” selection may be non-deterministic
- **Finding:** Uses `Object.values(ui.windows)` ordering to choose the “topmost” open packet.
- **Impact:** In rare cases, may select an unintended packet when multiple are open.
- **Recommendation:** If multiple matching packet windows are open, prompt the user to choose; otherwise keep the shortcut.
- **Status:** Open

---

#### 2. Scope scan iterates all journals unnecessarily
- **Finding:** Clears other current flags by scanning `game.journal.contents` directly each run.
- **Impact:** Minor performance overhead in large worlds.
- **Recommendation:** Precompute scoped packet list once and iterate only those.
- **Status:** Deferred (polish)

---

#### 3. Packet dropdown labels may be confusing if icons are out of sync
- **Finding:** Selection list displays raw `j.name` which may include stale status icons.
- **Impact:** Minor UX confusion.
- **Recommendation:** Display clean name (or clean + raw) in the selector.
- **Status:** Deferred (polish)

---

## Packet → Mark Active (v4)

**Category:** Packets / Invariants  
**Role:** Marks a packet Active and ensures it is also the sole Current packet in-scope  
**Mutation:** Yes (`flags.lancer.packetStatus`, `flags.lancer.currentPacket`)

### Findings

#### 1. Fallback “currentPacket” target selection is not mission-scoped
- **Finding:** When no open packet is found, the macro selects the first `currentPacket===true` in the entire world without checking the mission tag prefix.
- **Impact:** Can activate the wrong mission’s packet when multiple missions exist in the same world.
- **Recommendation:** Require `clean.startsWith(tagPrefix)` in the fallback selection.
- **Status:** Open

---

#### 2. Open-window “topmost” selection may be non-deterministic
- **Finding:** Uses `Object.values(ui.windows)` ordering to choose “topmost” open packet.
- **Impact:** In rare cases, may select an unintended packet when multiple are open.
- **Recommendation:** If multiple matching packet windows are open, prompt the user to choose; otherwise keep the shortcut.
- **Status:** Open

---

#### 3. Packet dropdown labels may be confusing if icons are out of sync
- **Finding:** Selection list displays raw `j.name` which may include stale status icons.
- **Impact:** Minor UX confusion.
- **Recommendation:** Display clean name (or clean + raw) in the selector.
- **Status:** Deferred (polish)

---

## Packet → Mark Completed (v4)

**Category:** Packets / Lifecycle  
**Role:** Marks the current packet Completed and clears `currentPacket`  
**Mutation:** Yes (`flags.lancer.packetStatus`, `flags.lancer.currentPacket`)

### Findings

#### 1. Fallback completion target may be unsafe when Current is missing
- **Finding:** If no `currentPacket` is set, the macro falls back to completing the “topmost open packet.”
- **Impact:** Can complete an unintended packet when multiple packets are open or when state is inconsistent.
- **Recommendation:** If no Current exists, prompt the user (or only auto-select when exactly one in-scope packet window is open).
- **Status:** Open

---

#### 2. Open-window “topmost” selection may be non-deterministic
- **Finding:** Uses `Object.values(ui.windows)` ordering to choose “topmost” open packet.
- **Impact:** In rare cases, may select an unintended packet when multiple are open.
- **Recommendation:** If multiple matching packet windows are open, prompt the user to choose; otherwise keep the shortcut.
- **Status:** Open

---

## Session Loop — One Button (v4.1)

**Category:** QoL / Orchestration  
**Role:** Completes current packet, optionally advances Threat, and activates the next packet via “Next Packet” UUID  
**Mutation:** Yes (packet flags, packet names/icons, threat state, optional threat notes stamped into packet journal)

### Findings

#### 1. Clears `currentPacket` flags globally (scope leak)
- **Finding:** The macro unsets `flags.lancer.currentPacket` for all journals in the world.
- **Impact:** Breaks multi-mission worlds by clearing Current packets outside the active mission scope.
- **Recommendation:** Restrict “clear stray currents” to in-scope packet journals (`PREFIX M#` + packet match).
- **Status:** Open

---

#### 2. Next packet is not validated to be within the same mission scope
- **Finding:** Next packet is validated as a packet, but not as belonging to the same `PREFIX M#` scope.
- **Impact:** A mislinked “Next Packet” can advance into another mission.
- **Recommendation:** Require `stripStatusIconPrefix(next.name).startsWith(tagPrefix)` before advancing.
- **Status:** Open

---

#### 3. Current packet selection is global and ambiguous under anomaly
- **Finding:** Selects the first journal with `currentPacket===true` without handling multiple-current anomalies deterministically.
- **Impact:** Under inconsistent state, may complete/advance the wrong packet.
- **Recommendation:** If multiple currents exist, prompt the user or select deterministically within a resolved scope.
- **Status:** Open

---

#### 4. Threat stamping label could be clearer
- **Finding:** UI label “Stamp completed packet” actually stamps a Threat note block into the completed packet journal.
- **Impact:** Minor UX ambiguity.
- **Recommendation:** Rename to “Stamp threat note into completed packet.”
- **Status:** Deferred (polish)

---

## Packet → Mark Next Links (v1)

**Category:** Packets / Content Markup  
**Role:** Marks “Next Packet” UUID blocks in packet journals using `data-lancer-next="1"` for reliable parsing  
**Mutation:** Yes (journal page HTML content only)

### Findings

#### 1. Marking implementation may duplicate existing Next Packet content
- **Finding:** The replacement injects a new `<p data-lancer-next="1">` containing the UUID without ensuring an existing UUID paragraph is removed or reused.
- **Impact:** Can result in duplicate UUID lines or extra paragraphs depending on original formatting.
- **Recommendation:** Prefer adding the `data-lancer-next="1"` attribute to an existing `<p>` that contains the UUID, rather than inserting a new paragraph.
- **Status:** Open

---

#### 2. “Already marked” check is broader than necessary
- **Finding:** Skips marking if `data-lancer-next="1"` appears anywhere in the matched substring.
- **Impact:** Rare false negatives if markup contains the attribute outside the intended UUID wrapper.
- **Recommendation:** Check specifically for an element wrapping the Next Packet UUID (e.g., `<p ... data-lancer-next="1"...>`).
- **Status:** Deferred (low risk)

---

#### 3. Counter variables are misleading / partially unused
- **Finding:** `touched` is incremented but not reported; `modified` effectively counts packets modified (one page max per packet) while the label says “Pages modified.”
- **Impact:** Minor reporting ambiguity.
- **Recommendation:** Replace with explicit counters (`packetsModified`, optionally `pagesScanned`) and remove unused variables.
- **Status:** Deferred (polish)

---

#### 4. Session Loop does not currently prefer the marker
- **Finding:** Session Loop extracts Next UUID via header/label regex and does not use `data-lancer-next="1"` as a primary signal.
- **Impact:** Marking improves readability but doesn’t fully harden the advancing logic.
- **Recommendation:** Update Session Loop to first search for an element containing `data-lancer-next="1"` and extract the UUID from there.
- **Status:** Open

---

## Packet → Assign Scene (v1.2)

**Category:** Packets / Scene Binding  
**Role:** Binds a Scene to a Packet via `flags.lancer.packetSceneId` and optionally writes a Scene block into the packet journal page  
**Mutation:** Yes (packet flag; optional journal page HTML content)

### Findings

#### 1. Fallback detection can miss an open packet if a non-packet journal is “topmost”
- **Finding:** Fallback selects the topmost open journal window first, then validates whether it is a packet.
- **Impact:** If a non-packet journal is topmost, the macro exits with a warning even if a packet journal is open.
- **Recommendation:** In fallback mode, filter open windows to packet journals first, then select the topmost packet.
- **Status:** Open

---

#### 2. “Clear Binding” does not remove embedded Scene block
- **Finding:** Clear action unsets the `packetSceneId` flag but leaves the `data-osr-scene-block="1"` section in the journal page.
- **Impact:** Page content can drift from authoritative flag state and confuse GMs.
- **Recommendation:** Optionally remove the Scene block section when clearing (viewed page fallback: first text page).
- **Status:** Open

---

#### 3. Mission scope is implicit
- **Finding:** Macro operates on detected packet without explicit mission scoping.
- **Impact:** In multi-mission worlds, mis-set Current packet could lead to binding scenes to the wrong mission packet.
- **Recommendation:** Display parsed `PREFIX M#` scope in the dialog for confirmation, or add an optional “confirm packet” selector when multiple packets are open.
- **Status:** Deferred (design choice)

---

## Repo Hygiene

### Finding: Macro/file content mismatch encountered during review
- **Finding:** The file provided when requested (“Packet Open Bound Scene (v1)”) contained dashboard build/refresh logic instead of scene-opening logic.
- **Impact:** Review becomes error-prone; increases risk of shipping incorrect macros or confusing GM workflows.
- **Recommendation:** Verify macro file names match their internal titles and responsibilities; consider adding a small header convention (Macro Name + Version + Purpose) and run a quick audit for duplicates/misfiles.
- **Status:** Open

---

## Packet → Open Player View (v2)

**Category:** Packets / Player-Facing Derived View  
**Role:** Builds/updates a player-safe journal entry derived from the Current packet, removing GM-only content  
**Mutation:** Yes (derived journal page content only)

### Findings

#### 1. Player stripping relies on fragile regex heuristics
- **Finding:** `stripForPlayers()` removes content based on patterns like “a `<p>` containing two UUIDs” and a broad “Next Packet” header deletion.
- **Impact:** Can accidentally remove legitimate player-facing content or fail to strip GM-only content if formatting changes.
- **Recommendation:** Prefer explicit markup conventions (e.g., `<section data-lancer-gm="1">` and `data-lancer-next="1"` wrappers) and strip by attributes rather than heuristics.
- **Status:** Open

---

#### 2. “Next Packet” strip may remove more than intended
- **Finding:** Deletes everything from `<h2>Next Packet</h2>` until the next `<h2>` or end of page.
- **Impact:** Potential over-deletion if document structure varies (e.g., nested headings, missing h2 boundaries).
- **Recommendation:** Strip only the specifically marked Next Packet block (e.g., element containing `data-lancer-next="1"`).
- **Status:** Open

---

#### 3. Meta folder selection can be ambiguous if multiple roots exist
- **Finding:** Chooses the first folder matching `${prefix} M${mission} — *`.
- **Impact:** Rare ambiguity in worlds with duplicates/archives.
- **Recommendation:** Prefer a root that contains a `Meta` child; otherwise resolve deterministically.
- **Status:** Deferred (low risk)

---

## Packet → Spawn Encounter from Templates (v1)

**Category:** Packets / Spawning / Recovery  
**Role:** Clones template Actors into a packet-scoped folder and optionally places tokens in the bound packet scene; records spawn operations for undo  
**Mutation:** Yes (creates Actors, creates Tokens, writes `flags.lancer.spawnRecords`, sets/uses `packetActorFolderId`)

### Findings

#### 1. Packet journal detection is not validated
- **Finding:** `getCurrentJournalEntry()` can return any open/selected JournalEntry and does not verify it is a packet journal (B##/C##) or in the intended mission scope.
- **Impact:** Spawns can be attached to the wrong journal, producing actors/tokens in the wrong packet context.
- **Recommendation:** Validate detected journal is a packet; if not, prompt the user to select a packet or fallback to `currentPacket`-flagged journal.
- **Status:** Open

---

#### 2. Packet actor folder name uses raw journal name (may include status icons)
- **Finding:** Folder name is derived from `packetJE.name` which can include leading status icons.
- **Impact:** Folder naming can drift or look inconsistent after icon sync operations.
- **Recommendation:** Use the icon-stripped clean packet name when generating folder names.
- **Status:** Open

---

#### 3. No guardrails against accidental duplicate spawns
- **Finding:** Re-running the macro with the same templates/filter will create duplicates (macro is reversible but not idempotent).
- **Impact:** Easy to unintentionally flood a packet folder with duplicate actors/tokens.
- **Recommendation:** Add a confirmation step that summarizes counts before spawning and/or optional checks to avoid duplicates in the packet folder.
- **Status:** Open

---

#### 4. Token placement position selection may be fragile on unusual scenes
- **Finding:** Token drop uses `scene.width/height` and grid size assumptions.
- **Impact:** Rare misplacement on scenes with unusual dimensions/settings.
- **Recommendation:** Consider using `scene.dimensions` when available; otherwise keep current behavior.
- **Status:** Deferred (low risk)

---

## Packet → Undo Spawn (v1)

**Category:** Packets / Recovery  
**Role:** Removes actors/tokens created by a selected spawn record stored on the packet journal  
**Mutation:** Yes (deletes Tokens, deletes Actors, updates `flags.lancer.spawnRecords`)

### Findings

#### 1. Packet journal detection is not validated
- **Finding:** Macro may operate on any open/selected JournalEntry without verifying it is a packet journal.
- **Impact:** Risk of undoing spawns from an unintended journal context.
- **Recommendation:** Validate detected journal is a packet (B##/C##); if not, prompt the user to select a packet journal (or fallback to `currentPacket`-flagged packet).
- **Status:** Open

---

#### 2. No final confirmation before destructive deletion
- **Finding:** After choosing a record, the macro immediately deletes tokens and actors.
- **Impact:** Misclicks can cause irreversible deletions.
- **Recommendation:** Add a second confirmation dialog summarizing counts (actors/tokens/scenes) before executing deletion.
- **Status:** Open

---

#### 3. Undo outcome is not summarized for auditability
- **Finding:** Skips missing scenes/tokens/actors silently (safe) but does not report what was actually deleted vs missing.
- **Impact:** Harder to verify recovery success in complex scenes.
- **Recommendation:** Report deleted vs missing counts in notification and/or console.
- **Status:** Deferred (polish)

---

## Packet → Create / Assign Actor Folder (v1)

**Category:** Packets / Organization  
**Role:** Creates/reuses a packet-scoped Actor folder and binds it via `flags.lancer.packetActorFolderId`  
**Mutation:** Yes (creates Actor folders; sets packet flag)

### Findings

#### 1. Mission root lookup likely uses the wrong folder type
- **Finding:** `findMissionRoot` searches for a top-level folder of `type === "Actor"` named `${prefix} M${mission} — ${missionName}`. The toolkit’s mission structure is primarily journal-folder based, and an Actor mission root may not exist.
- **Impact:** Macro may frequently fail even when a mission exists.
- **Recommendation:** Make the macro self-sufficient by creating (or locating) a parallel Actor mission root folder tree, independent of JournalEntry folders.
- **Status:** Open

---

#### 2. Packet folder name derivation appears broken
- **Finding:** `packetFolderName` uses two chained regex replacements that produce unpredictable results.
- **Impact:** Packet folders may be named inconsistently or incorrectly.
- **Recommendation:** Use a clear parse of `B##/C##` and optional descriptor to build a deterministic folder name (e.g., `B12 — Docking Bay`).
- **Status:** Open

---

#### 3. Mission name inference is fragile and can default to “Mission”
- **Finding:** `missionNameGuess` depends on finding an existing Actor folder root; otherwise defaults to `"Mission"` which then breaks root resolution.
- **Impact:** Adds friction and failure modes in fresh worlds.
- **Recommendation:** Prompt for mission name or create an Actor mission root with a safe default that can be renamed later.
- **Status:** Open

---

## Packet → Refresh Status Icons (v4)

**Category:** Packets / Consistency  
**Role:** Normalizes packet journal name prefixes to a strict `<ICON><space><clean name>` format using `flags.lancer.packetStatus` as truth  
**Mutation:** Yes (journal names only)

### Findings

#### 1. Emoji variant handling should explicitly support `▶` and `▶️`
- **Finding:** Prefix stripping uses a character class `[⏳▶️✅]` which can be unreliable for multi-codepoint emoji sequences (e.g., `▶` + VS16).
- **Impact:** Rare failure to strip existing active icon prefixes, leading to double-prefix or drift.
- **Recommendation:** Use an alternation with optional VS16: `(?:⏳|✅|▶)(?:\\uFE0F)?` (as used elsewhere in OSR_LIB).
- **Status:** Open (small fix)

---

#### 2. Shared OSR_LIB implementations are inconsistent across macros
- **Finding:** Multiple macros include slightly different `stripStatusIconPrefix` logic and INVIS sets.
- **Impact:** Increased drift risk and harder maintenance.
- **Recommendation:** Standardize on this macro’s normalization/strip behavior and reuse it across all macros.
- **Status:** Open (repo refactor)

---

## Open Current Packet (v2)

**Category:** Packets / Navigation  
**Role:** Opens the in-scope packet journal with `flags.lancer.currentPacket === true`  
**Mutation:** No (UI-only)

### Findings

#### 1. Multiple-current anomaly is not handled deterministically
- **Finding:** Uses `.find()`; if multiple Current packets exist, selection depends on world order.
- **Impact:** Under inconsistent state, may open the wrong packet.
- **Recommendation:** If multiple currents are found in scope, warn and select deterministically (e.g., sort by clean name and pick first) or prompt.
- **Status:** Deferred (low risk; Audit fixes it)

---

#### 2. Failure message could be more actionable
- **Finding:** Warns “No Current Packet set.” without guidance.
- **Impact:** Minor friction for GMs.
- **Recommendation:** Suggest running “Set Current Packet (v2)” (and optionally “Packet → Mark Active (v4)”).
- **Status:** Deferred (polish)

---

## Packet → Advance Next (open only)

**Category:** Packets / Navigation  
**Role:** Opens the “Next Packet” journal linked from the Current packet; does not modify flags/state  
**Mutation:** No (UI-only)

### Findings

#### 1. Next packet is not validated to be within the same mission scope
- **Finding:** Validates that the target is a packet, but does not ensure it belongs to the same `PREFIX M#` scope as the Current packet.
- **Impact:** Mislinked Next Packet can jump across missions.
- **Recommendation:** Parse scope from Current packet name and require `nextClean.startsWith(tagPrefix)`.
- **Status:** Open

---

#### 2. Does not prefer `data-lancer-next="1"` marker
- **Finding:** Extracts Next UUID via header/label regex and last-UUID fallback.
- **Impact:** Less robust than using the explicit marker your toolkit can add.
- **Recommendation:** First search for a UUID inside an element marked `data-lancer-next="1"`, then fall back to header/label matching.
- **Status:** Open

---

#### 3. Multiple-current anomaly is not handled deterministically
- **Finding:** Uses `.find()` on `currentPacket===true`.
- **Impact:** Under inconsistent state, may use the wrong Current packet.
- **Recommendation:** If multiple currents exist, warn and select deterministically (or prompt).
- **Status:** Deferred (low risk)

---

## Packet → Mark Upcoming (v3)

**Category:** Packets / State  
**Role:** Sets a selected packet’s `packetStatus` to `upcoming` and clears `currentPacket`  
**Mutation:** Yes (packet flags)

### Findings

#### 1. Topmost-open selection should use deterministic z-ordering
- **Finding:** `topmostOpenPacket` relies on iteration order of `ui.windows` without sorting by `position.z`.
- **Impact:** May select a non-topmost window in some UI states.
- **Recommendation:** Sort candidate windows by `position.z` and choose the highest to match user expectation.
- **Status:** Open

---

#### 2. Optional UX: confirm demoting an Active packet
- **Finding:** Macro will set an Active packet back to Upcoming without confirmation.
- **Impact:** Can be surprising, but sometimes desired.
- **Recommendation:** If target status is `active`, optionally prompt for confirmation.
- **Status:** Deferred (polish)

---

#### 3. Icons are not synced (by design)
- **Finding:** Macro updates flags only; name icon may remain stale until Refresh Icons/Audit.
- **Impact:** Minor confusion for GMs relying on visible icons.
- **Recommendation:** Optionally offer “sync icons after change” or mention in notification.
- **Status:** Deferred (polish)

---

## Packet → Mark Active (v4)

**Category:** Packets / State  
**Role:** Sets a selected packet to `active` + `current`, enforcing single-current and optionally single-active within mission scope  
**Mutation:** Yes (packet flags)

### Findings

#### 1. Target selection should prioritize authoritative current packet
- **Finding:** Chooses `topmostOpenPacket` before checking for an in-scope `currentPacket`.
- **Impact:** If a non-current packet is open, it may be activated unintentionally.
- **Recommendation:** Prefer in-scope `currentPacket` first, then topmost open packet, then picker.
- **Status:** Open

---

#### 2. “Topmost open” selection is not ordered by z-index
- **Finding:** `topmostOpenPacket` relies on iteration order of `ui.windows`.
- **Impact:** May select a non-topmost packet window.
- **Recommendation:** Sort candidate windows by `position.z` and choose the highest.
- **Status:** Open

---

#### 3. Current-packet fallback is not mission-scoped
- **Finding:** Fallback `find(currentPacket===true)` does not require `clean.startsWith(tagPrefix)`.
- **Impact:** Could activate a packet from a different mission in multi-mission worlds.
- **Recommendation:** Apply the same `tagPrefix` scope constraint when selecting the fallback current packet.
- **Status:** Open

---

## Packet → Mark Completed (v4)

**Category:** Packets / State  
**Role:** Sets a selected packet’s `packetStatus` to `completed` and clears `currentPacket`  
**Mutation:** Yes (packet flags)

### Findings

#### 1. Topmost-open selection should use deterministic z-ordering
- **Finding:** `topmostOpenPacket` relies on iteration order of `ui.windows` without sorting by `position.z`.
- **Impact:** May select a non-topmost packet window in some UI states.
- **Recommendation:** Sort candidate windows by `position.z` and choose the highest.
- **Status:** Open

---

#### 2. Optional UX: add picker fallback when no current/open packet exists
- **Finding:** If no current packet is set and none is open, macro ends with “No packet detected.”
- **Impact:** Minor friction in edge cases.
- **Recommendation:** Offer a packet picker as a last resort (consistent with other state setters).
- **Status:** Deferred (polish)

---

## Packet → RESET ALL (v3)

**Category:** Packets / Emergency Recovery  
**Role:** Sets all in-scope packets to `upcoming` and clears `currentPacket` across the mission  
**Mutation:** Yes (packet flags)

### Findings

#### 1. Destructive action should use a two-step confirmation
- **Finding:** A single “RESET” click applies changes immediately.
- **Impact:** Misclick risk is high during fast GM operations.
- **Recommendation:** Add a second confirmation step (e.g., type `RESET` or check an “I understand” box) before applying changes.
- **Status:** Open

---

#### 2. Reporting uses “operations” count, not packets affected
- **Finding:** `changed` increments per flag update, mixing status changes and current clears.
- **Impact:** Harder to reason about impact after execution.
- **Recommendation:** Track and report counts separately: packets touched, status changes, current clears; also log details to console.
- **Status:** Open

---

#### 3. Optional UX: refresh status icons after reset
- **Finding:** Names/icons may remain stale after flags are reset.
- **Impact:** Visual confusion immediately after using RESET.
- **Recommendation:** Offer a checkbox to run icon normalization after reset (default on).
- **Status:** Deferred (polish)

---

## Packet Meta Cleanup Utility (v9-anchored, safe)

**Category:** Mission Meta / Recovery  
**Role:** Detects duplicate `Meta` folders under a mission root, optionally moves journals into the v9-anchored Meta folder and deletes empty duplicates (with confirmation)  
**Mutation:** Yes (journal folder changes; optional folder deletions)

### Findings

#### 1. `stripStatusIconPrefix` should handle emoji variants robustly
- **Finding:** Uses `/^[⏳▶️✅]\s*/` which can be unreliable for multi-codepoint emoji sequences (e.g., `▶` + optional VS16).
- **Impact:** Rare failure to match Mission Overview name when status icons are present, breaking v9 anchor lookup.
- **Recommendation:** Use canonical OSR_LIB stripping: `(?:⏳|✅|▶)(?:\uFE0F)?` plus INVIS removal.
- **Status:** Open (small fix)

---

#### 2. Use `game.journal.contents.find` for API consistency
- **Finding:** Uses `game.journal.find(...)` while other macros use `game.journal.contents.find(...)`.
- **Impact:** Potential API mismatch across Foundry versions / collections.
- **Recommendation:** Standardize on `game.journal.contents`.
- **Status:** Open (small fix)

---

#### 3. Optional validation: ensure the anchored folder is actually named `Meta`
- **Finding:** Anchors to Mission Overview’s folder, regardless of its name.
- **Impact:** If Overview is mis-filed, cleanup could merge into the wrong folder.
- **Recommendation:** Warn (or require) that the anchor folder name is exactly `Meta`.
- **Status:** Deferred (polish)

---

## Packet → Create Scene from Template (v1)

**Category:** Packets / Scenes  
**Role:** Creates a scene (optionally cloned from a template), optionally binds it to the packet and writes a Scene link block into the packet journal page  
**Mutation:** Yes (scene creation; packet flag binding; optional journal page update)

### Findings

#### 1. Reuse-by-name may bind the wrong scene across missions/world copies
- **Finding:** Reuses an existing scene purely by `s.name === newName`.
- **Impact:** If identical names exist (multiple missions or world copies), packet could bind to an unintended scene.
- **Recommendation:** On scene creation, stamp provenance in `flags.lancer` (e.g., mission tag + packet id/name). On reuse, only reuse scenes with matching provenance.
- **Status:** Open

---

#### 2. “Force create” can still reuse instead of creating
- **Finding:** Even with `forceCreate`, macro will reuse an existing scene with the same name (so no new scene is created).
- **Impact:** GM expects a new scene but gets existing/reused scene.
- **Recommendation:** If `forceCreate` is checked, bypass name-reuse and create a uniquely named scene (e.g., add suffix or timestamp).
- **Status:** Open

---

#### 3. Optional: background field coverage across Foundry versions
- **Finding:** Clears `t.background.src` and `t.img`, but other background/foreground fields may exist.
- **Impact:** Rare cases where background still clones unexpectedly.
- **Recommendation:** Expand background clearing to include other known fields if encountered.
- **Status:** Deferred (polish)

