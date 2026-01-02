/**
 * Lancer Mission Journal Generator (Foundry VTT v12) — v9 (CLEAN)
 * Fixes Jump row reliably by:
 *  - Writing Quick Links into the FIRST text page (not a guessed "Page" name)
 *  - ALWAYS normalizing/replacing any existing QL block (or inserting if missing)
 *  - Using a marker <p data-lancer-ql="1"> ... </p> so we can replace it deterministically
 *  - Auto-wiring all @UUID links (including XXXXX placeholders) after creation
 * Adds:
 *  - Optional combats toggle (mark a line with |optional)
 *  - Downtime journal (Meta)
 *  - Auto Mission Flow + Linked Packets + Scene Packets
 *  - Auto “Next Packet” links in each Beat/Combat (ordered by C## then B## per number)
 *  - Ensures EVERY journal includes a Jump link to Mission Overview (in the Jump row)
 *
 * LIST FORMAT (one per line):
 *   ID|Title|TypeLabel|optional
 *
 * Example:
 *   C02|Look Both Ways|Combat|optional
 */

const DEFAULTS = {
  modulePrefix: "OSR",
  missionNumber: 1,
  missionName: "The Drop",

  includeOptionalCombats: true,
  createDowntimeJournal: true,
  forcePrefill: false,

  beatsText: [
    "B01|On the Move in a Military Manner|Narrative",
    "B02|Broken Sky|Narrative",
  ].join("\n"),

  combatsText: [
    "C01|It’s Not the Fall That Kills You…|Combat",
    "C02|Look Both Ways|Combat|optional",
    "C03|Downpour|Combat",
  ].join("\n"),
};

// -------------------- Helpers --------------------
function parseLines(text) {
  const lines = (text || "").split("\n").map(l => l.trim()).filter(Boolean);
  const out = [];
  for (const line of lines) {
    const parts = line.split("|").map(p => p.trim());
    if (parts.length < 2) continue;
    const [id, title, typeLabelRaw, optRaw] = parts;
    const typeLabel = typeLabelRaw || "Narrative";
    const optional = ["optional", "opt", "o", "true", "yes", "y"].includes(String(optRaw || "").toLowerCase());
    out.push({ id, title, typeLabel, optional });
  }
  return out;
}

function makeEntryName(prefix, M, id, title, typeLabel) {
  return `${prefix} ${M} ${id} — ${title} (${typeLabel})`;
}
function makeMetaName(prefix, M, label, missionName) {
  return `${prefix} ${M} — ${label}: ${missionName}`;
}
function makeDowntimeName(prefix, M) {
  return `${prefix} ${M} — Downtime`;
}

function idKey(id) {
  const m = String(id).match(/([A-Za-z]+)(\d+)/);
  const pfx = m ? m[1].toUpperCase() : id.toUpperCase();
  const num = m ? Number(m[2]) : 9999;
  const pri = (pfx === "C") ? 1 : (pfx === "B" ? 2 : 3);
  return { num, pri, pfx };
}

function placeholderLinkForName(name) {
  return `@UUID[JournalEntry.XXXXXXXXXXXXXXX]{${name}}`;
}

// -------------------- Quick Links (Jump Row) --------------------
function quickLinksHeader(prefix, M, missionName) {
  // REQUIREMENT: always includes Mission Overview
  return `
<p data-lancer-ql="1">
<strong>Jump:</strong>
@UUID[JournalEntry.XXXXXXXXXXXXXXX]{${makeMetaName(prefix, M, "Mission Overview", missionName)}}
&nbsp;•&nbsp;
@UUID[JournalEntry.XXXXXXXXXXXXXXX]{${makeMetaName(prefix, M, "Simple Quest", missionName)}}
&nbsp;•&nbsp;
@UUID[JournalEntry.XXXXXXXXXXXXXXX]{${makeMetaName(prefix, M, "Mission Debrief", missionName)}}
&nbsp;•&nbsp;
@UUID[JournalEntry.XXXXXXXXXXXXXXX]{${makeDowntimeName(prefix, M)}}
</p>
<hr>
`.trim();
}

// Remove ANY existing QL block by marker, regardless of content within
function removeExistingQuickLinks(content) {
  if (!content) return "";

  let out = content;

  // Remove the marker paragraph block (non-greedy)
  out = out.replace(/<p[^>]*data-lancer-ql="1"[^>]*>[\s\S]*?<\/p>\s*/gi, "");

  // Remove an immediate HR that often follows (one or more)
  out = out.replace(/^\s*(<hr\s*\/?>\s*)+/i, "");

  return out.trim();
}

// -------------------- Foundry Doc Utilities --------------------
async function ensureFolder(name, parentFolderId = null) {
  let folder = game.folders.find(f =>
    f.type === "JournalEntry" &&
    f.name === name &&
    (parentFolderId ? f.folder === parentFolderId : !f.folder)
  );
  if (!folder) folder = await Folder.create({ name, type: "JournalEntry", folder: parentFolderId, sorting: "a" });
  return folder;
}

async function getOrCreateFirstTextPage(journal) {
  // CRITICAL FIX: operate on the FIRST EXISTING TEXT PAGE, not a guessed page name.
  const existingText = journal.pages?.contents?.find(p => p.type === "text");
  if (existingText) return existingText;

  const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
    name: "Page",
    type: "text",
    text: { content: "" }
  }]);
  return page;
}

async function createOrMoveJournal(targetFolder, spec) {
  let journal = game.journal.find(j => j.name === spec.name);

  if (!journal) {
    journal = await JournalEntry.create({
      name: spec.name,
      folder: targetFolder.id,
      pages: [{ name: spec.pageName, type: "text", text: { content: "" } }]
    });
    return { journal, action: "created" };
  }

  const moved = journal.folder?.id !== targetFolder.id;
  if (moved) await journal.update({ folder: targetFolder.id });

  // Ensure at least one text page exists (first page is enough)
  await getOrCreateFirstTextPage(journal);

  return { journal, action: moved ? "moved" : "exists" };
}

// -------------------- "Empty" detection for safe prefills --------------------
function stripForEmptiness(content) {
  const noQL = removeExistingQuickLinks(content);
  return (noQL || "")
    .replace(/<\/?(br|hr)\s*\/?>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function isEmptyOrOnlyQuickLinks(content) {
  return stripForEmptiness(content) === "";
}

// -------------------- Auto packet ordering + lists + next map --------------------
function buildOrderedPackets(prefix, M, beats, combats) {
  const all = [
    ...combats.map(c => ({
      id: c.id,
      kind: "combat",
      label: makeEntryName(prefix, M, c.id, c.title, c.typeLabel),
      title: c.title
    })),
    ...beats.map(b => ({
      id: b.id,
      kind: "beat",
      label: makeEntryName(prefix, M, b.id, b.title, b.typeLabel),
      title: b.title
    })),
  ].sort((a, b) => {
    const ak = idKey(a.id), bk = idKey(b.id);
    if (ak.num !== bk.num) return ak.num - bk.num;
    if (ak.pri !== bk.pri) return ak.pri - bk.pri;
    return ak.pfx.localeCompare(bk.pfx);
  });

  return all;
}

function buildPacketLists(orderedPackets) {
  const missionFlowHtml =
    `<ol>\n` +
    orderedPackets.map(p => `  <li><strong>${p.label}</strong><br>[1-line summary]</li>`).join("\n") +
    `\n</ol>`;

  const linkedPacketsHtml =
    `<ul>\n` +
    orderedPackets.map(p => `  <li>${placeholderLinkForName(p.label)}</li>`).join("\n") +
    `\n</ul>`;

  const scenePacketsHtml =
    `<ul>\n` +
    orderedPackets.map(p => `  <li>${placeholderLinkForName(p.label)}</li>`).join("\n") +
    `\n</ul>`;

  return { missionFlowHtml, linkedPacketsHtml, scenePacketsHtml };
}

function buildNextMap(orderedPackets) {
  const next = new Map();
  for (let i = 0; i < orderedPackets.length; i++) {
    next.set(orderedPackets[i].label, orderedPackets[i + 1]?.label ?? null);
  }
  return next;
}

// -------------------- Templates --------------------
function templateMissionOverview(prefix, M, missionName, lists) {
  return `
<h1>Mission Overview — ${missionName}</h1>
<p><em>${prefix}, ${M}. GM reference + navigation hub.</em></p>
<hr>

<h2>Mission Premise (SOURCE)</h2>
<p>[Paste/condense source premise. Keep canon phrasing where possible.]</p>

<hr>

<h2>Mission Objectives (SOURCE)</h2>
<ul>
  <li>[Objective 1]</li>
  <li>[Objective 2]</li>
  <li>[Objective 3]</li>
</ul>

<hr>

<h2>Mission Flow (SOURCE)</h2>
${lists.missionFlowHtml}

<hr>

<h2>Linked Packets</h2>
${lists.linkedPacketsHtml}

<hr>

<section class="secret">
  <h2>GM Tooling (Optional)</h2>
  <ul>
    <li>Keep this open during play.</li>
    <li>Update Simple Quest as objectives change.</li>
  </ul>
</section>
`.trim();
}

function templateSimpleQuest(prefix, M, missionName, lists) {
  return `
<h1>${prefix} — ${M}: ${missionName}</h1>
<hr>

<h2>Scene Packets</h2>
${lists.scenePacketsHtml}

<hr>

<h2>Primary Objectives (SOURCE phrasing)</h2>
<ul>
  <li>[Objective 1]</li>
  <li>[Objective 2]</li>
  <li>[Objective 3]</li>
</ul>

<hr>

<h2>Optional Objectives (SOURCE phrasing)</h2>
<ul>
  <li>[Optional objective]</li>
</ul>

<hr>

<h2>Rewards / Assets</h2>
<ul>
  <li>[Reward 1]</li>
  <li>[Reward 2]</li>
</ul>
`.trim();
}

function templateMissionDebrief(missionName) {
  return `
<h1>Mission Debrief — ${missionName}</h1>
<hr>

<h2>Mission Summary (SOURCE)</h2>
<p>[Short summary]</p>

<hr>

<h2>Primary Objectives — Resolution (SOURCE)</h2>
<ul>
  <li>[ ] [Objective 1]</li>
  <li>[ ] [Objective 2]</li>
  <li>[ ] [Objective 3]</li>
</ul>

<hr>

<h2>Rewards & Assets (SOURCE)</h2>
<ul>
  <li>[ ] [Reserve earned]</li>
  <li>[ ] [Special reward]</li>
</ul>

<hr>

<section class="secret">
  <h2>GM Continuity Notes (Optional)</h2>
  <ul>
    <li>[ ] Callback #1</li>
    <li>[ ] Callback #2</li>
    <li>[ ] Callback #3</li>
  </ul>
</section>
`.trim();
}

function templateDowntime(prefix, M) {
  return `
<h1>${prefix} ${M} — Downtime</h1>
<p><em>Between missions: structured actions + freeform roleplay.</em></p>
<hr>

<h2>Downtime Structure</h2>
<ul>
  <li><strong>Freeform play:</strong> roleplay scenes; GM can still award RESERVES.</li>
  <li><strong>Structured downtime actions:</strong> each player usually gets <strong>1 action</strong> (sometimes 2 for long downtime).</li>
</ul>

<hr>

<h2>RESERVES</h2>
<p>RESERVES represent advantages held for the next mission. They typically last for <strong>the next mission only</strong>.</p>

<hr>

<section class="secret">
  <h2>GM Checklist</h2>
  <ul>
    <li>Confirm downtime length + actions per player.</li>
    <li>Record generated RESERVES and remind the table they expire after the next mission.</li>
  </ul>
</section>
`.trim();
}

function templateBeat(prefix, M, beatTitle, nextLabel) {
  const nextBlock = nextLabel
    ? `<p><strong>${placeholderLinkForName(nextLabel)}</strong></p>`
    : `<p><em>No next packet (end of mission).</em></p>`;

  return `
<h1>${prefix} ${M} — Beat Packet (Narrative)</h1>
<p><strong>Beat:</strong> ${beatTitle}</p>
<hr>

<h2>Read Aloud (SOURCE)</h2>
<p>[Boxed text]</p>

<hr>

<h2>What PCs Learn (SOURCE)</h2>
<ul>
  <li>[Fact 1]</li>
  <li>[Fact 2]</li>
</ul>

<hr>

<h2>Choices & Stakes (SOURCE)</h2>
<ul>
  <li><strong>Option A:</strong> [Action] → [Consequence]</li>
  <li><strong>Option B:</strong> [Action] → [Consequence]</li>
</ul>

<hr>

<section class="secret">
  <h2>GM Notes (SOURCE)</h2>
  <ul><li>[Canon GM instruction / triggers]</li></ul>
</section>

<hr>

<h2>Next Packet</h2>
${nextBlock}
`.trim();
}

function templateCombat(prefix, M, encTitle, nextLabel) {
  const nextBlock = nextLabel
    ? `<p><strong>${placeholderLinkForName(nextLabel)}</strong></p>`
    : `<p><em>No next packet (end of mission).</em></p>`;

  return `
<h1>${prefix} ${M} — Combat Packet</h1>
<p><strong>Encounter:</strong> ${encTitle}</p>
<hr>

<h2>Situation (SOURCE)</h2>
<p>[Canon setup]</p>

<hr>

<h2>Player Objective (SOURCE)</h2>
<ul><li><strong>Primary:</strong> [Canon objective]</li></ul>

<hr>

<h2>SITREP (SOURCE)</h2>
<p><strong>[Sitrep Name]</strong> (Lancer Core, p. [###])</p>

<hr>

<h2>Battlefield Setup (SOURCE)</h2>
<ul>
  <li><strong>PC Deployment:</strong> [PDZ]</li>
  <li><strong>Enemy Deployment:</strong> [EDZ]</li>
  <li><strong>Special Rules:</strong> [Only if in source]</li>
</ul>

<hr>

<h2>Enemy Forces (SOURCE)</h2>
<ul>
  <li><strong>Base:</strong> [3/4/5 PC scaling]</li>
  <li><strong>Reinforcements:</strong> [Timing]</li>
</ul>

<hr>

<section class="secret">
  <h2>GM Tooling (Optional)</h2>
  <ul>
    <li>Mark Simple Quest objectives.</li>
    <li>Record earned reserves/rewards in Debrief.</li>
  </ul>
</section>

<hr>

<h2>Next Packet</h2>
${nextBlock}
`.trim();
}

function bodyForSpec(spec, category, prefix, M, missionName, lists, nextMap) {
  if (category === "meta") {
    if (spec.name.includes("Mission Overview")) return templateMissionOverview(prefix, M, missionName, lists);
    if (spec.name.includes("Simple Quest")) return templateSimpleQuest(prefix, M, missionName, lists);
    if (spec.name.includes("Mission Debrief")) return templateMissionDebrief(missionName);
    if (spec.name.endsWith("— Downtime")) return templateDowntime(prefix, M);
    return "";
  }

  const nextLabel = nextMap.get(spec.name) ?? null;
  if (category === "beats") return templateBeat(prefix, M, spec.pageName, nextLabel);
  if (category === "combats") return templateCombat(prefix, M, spec.pageName, nextLabel);
  return "";
}

// -------------------- Ensure Jump row (always) + Prefill --------------------
async function ensureJumpRow(journal, prefix, M, missionName) {
  const page = await getOrCreateFirstTextPage(journal);
  const current = page.text?.content ?? "";

  // Always normalize: remove old QL then prepend new
  const without = removeExistingQuickLinks(current);
  const rebuilt = `${quickLinksHeader(prefix, M, missionName)}\n${without}`.trim();

  if (rebuilt !== current.trim()) {
    await page.update({ "text.content": rebuilt });
    return { updated: true };
  }
  return { updated: false };
}

async function ensureTemplateBody(journal, spec, category, prefix, M, missionName, forcePrefill, lists, nextMap) {
  const page = await getOrCreateFirstTextPage(journal);
  const current = page.text?.content ?? "";

  // Always ensure Jump row first
  const qlResult = await ensureJumpRow(journal, prefix, M, missionName);

  // Re-read after Jump normalization
  const now = page.text?.content ?? "";
  const emptyish = isEmptyOrOnlyQuickLinks(now);

  if (!forcePrefill && !emptyish) {
    return { updated: false, reason: "non-empty", qlUpdated: qlResult.updated };
  }

  const body = bodyForSpec(spec, category, prefix, M, missionName, lists, nextMap);

  // IMPORTANT: preserve the Jump row we just normalized
  const preservedTop = quickLinksHeader(prefix, M, missionName);
  const rebuilt = `${preservedTop}\n${body}`.trim();

  if (rebuilt !== now.trim()) {
    await page.update({ "text.content": rebuilt });
    return { updated: true, reason: forcePrefill ? "forced" : "prefilled", qlUpdated: qlResult.updated };
  }

  return { updated: false, reason: "no-change", qlUpdated: qlResult.updated };
}

// -------------------- UUID Auto-Wiring (handles XXXXX placeholders) --------------------
function buildNameToUuidMap(journals) {
  const map = new Map();
  for (const j of journals) {
    map.set(j.name, `JournalEntry.${j.id}`);
    map.set(j.name.trim(), `JournalEntry.${j.id}`);
  }
  return map;
}

function rewriteJournalUuids(content, nameToUuid) {
  if (!content) return { changed: false, content };

  // Match any JournalEntry UUID target (real or placeholder), capture label in {...}
  const regex = /@UUID\[\s*JournalEntry\.[^\]]+\s*\]\{([^}]+)\}/g;
  let changed = false;

  const updated = content.replace(regex, (match, label) => {
    const key = String(label).trim();
    const uuid = nameToUuid.get(key);
    if (!uuid) return match;

    const replacement = `@UUID[${uuid}]{${label}}`;
    if (replacement !== match) changed = true;
    return replacement;
  });

  return { changed, content: updated };
}

async function autoWireAllEnsuredJournals(ensuredJournals) {
  const nameToUuid = buildNameToUuidMap(ensuredJournals);
  const updatedNames = [];

  for (const j of ensuredJournals) {
    // Update ALL text pages (not just first)
    for (const page of j.pages.contents) {
      if (page.type !== "text") continue;
      const current = page.text?.content ?? "";
      const r = rewriteJournalUuids(current, nameToUuid);
      if (r.changed) {
        await page.update({ "text.content": r.content });
        if (!updatedNames.includes(j.name)) updatedNames.push(j.name);
      }
    }
  }
  return updatedNames;
}

// -------------------- Dialog --------------------
const dialogContent = `
<form>
  <div class="form-group">
    <label>Module Prefix</label>
    <input type="text" name="modulePrefix" value="${DEFAULTS.modulePrefix}"/>
  </div>

  <div class="form-group">
    <label>Mission Number</label>
    <input type="number" name="missionNumber" value="${DEFAULTS.missionNumber}" min="1" step="1"/>
  </div>

  <div class="form-group">
    <label>Mission Name</label>
    <input type="text" name="missionName" value="${DEFAULTS.missionName}"/>
  </div>

  <div class="form-group">
    <label>Beats (ID|Title|TypeLabel)</label>
    <textarea name="beatsText" rows="6" style="font-family:monospace;">${DEFAULTS.beatsText}</textarea>
  </div>

  <div class="form-group">
    <label>Combats (ID|Title|TypeLabel|optional)</label>
    <textarea name="combatsText" rows="6" style="font-family:monospace;">${DEFAULTS.combatsText}</textarea>
    <p class="notes">Add <code>|optional</code> to mark optional encounters.</p>
  </div>

  <div class="form-group">
    <label>
      <input type="checkbox" name="includeOptionalCombats" ${DEFAULTS.includeOptionalCombats ? "checked" : ""}/>
      Include Optional Combats
    </label>
  </div>

  <div class="form-group">
    <label>
      <input type="checkbox" name="createDowntimeJournal" ${DEFAULTS.createDowntimeJournal ? "checked" : ""}/>
      Create Downtime Journal (Meta)
    </label>
  </div>

  <div class="form-group">
    <label>
      <input type="checkbox" name="forcePrefill" ${DEFAULTS.forcePrefill ? "checked" : ""}/>
      Force Prefill (overwrite existing content)
    </label>
  </div>
</form>
`;

new Dialog({
  title: "Lancer Mission Journal Generator (v9) — Jump Row Fixed",
  content: dialogContent,
  buttons: {
    run: {
      icon: '<i class="fas fa-play"></i>',
      label: "Create / Update",
      callback: async (html) => {
        try {
          const form = html[0].querySelector("form");

          const prefix = form.modulePrefix.value.trim() || "MOD";
          const missionNumber = Number(form.missionNumber.value || 1);
          const missionName = form.missionName.value.trim() || "Mission";
          const includeOptionalCombats = !!form.includeOptionalCombats.checked;
          const createDowntimeJournal = !!form.createDowntimeJournal.checked;
          const forcePrefill = !!form.forcePrefill.checked;

          const beats = parseLines(form.beatsText.value);
          let combats = parseLines(form.combatsText.value);
          if (!includeOptionalCombats) combats = combats.filter(c => !c.optional);

          const M = `M${missionNumber}`;
          const topFolderName = `${prefix} ${M} — ${missionName}`;
          const SUBFOLDERS = { meta: "Meta", beats: "Beats", combats: "Combats" };

          const orderedPackets = buildOrderedPackets(prefix, M, beats, combats);
          const lists = buildPacketLists(orderedPackets);
          const nextMap = buildNextMap(orderedPackets);

          // Specs
          const specs = { meta: [], beats: [], combats: [] };

          specs.meta.push({ name: makeMetaName(prefix, M, "Mission Overview", missionName), pageName: "Overview" });
          specs.meta.push({ name: makeMetaName(prefix, M, "Simple Quest", missionName), pageName: "Quest" });
          specs.meta.push({ name: makeMetaName(prefix, M, "Mission Debrief", missionName), pageName: "Debrief" });
          if (createDowntimeJournal) specs.meta.push({ name: makeDowntimeName(prefix, M), pageName: "Downtime" });

          for (const b of beats) specs.beats.push({ name: makeEntryName(prefix, M, b.id, b.title, b.typeLabel), pageName: b.title });
          for (const c of combats) specs.combats.push({ name: makeEntryName(prefix, M, c.id, c.title, c.typeLabel), pageName: c.title });

          // Create folders
          const top = await ensureFolder(topFolderName);
          const metaFolder = await ensureFolder(SUBFOLDERS.meta, top.id);
          const beatsFolder = await ensureFolder(SUBFOLDERS.beats, top.id);
          const combatsFolder = await ensureFolder(SUBFOLDERS.combats, top.id);
          const folderMap = { meta: metaFolder, beats: beatsFolder, combats: combatsFolder };

          const results = {
            created: [], moved: [], exists: [],
            jumpUpdated: [],
            templated: [], skipped: [],
            autoWired: []
          };

          const ensuredJournals = [];

          // Create/move + ensure Jump row + template bodies
          for (const category of ["meta", "beats", "combats"]) {
            for (const spec of specs[category]) {
              const r = await createOrMoveJournal(folderMap[category], spec);
              results[r.action].push(r.journal.name);
              ensuredJournals.push(r.journal);

              // Always normalize Jump row (even if we skip templating)
              const jr = await ensureJumpRow(r.journal, prefix, M, missionName);
              if (jr.updated) results.jumpUpdated.push(r.journal.name);

              const t = await ensureTemplateBody(r.journal, spec, category, prefix, M, missionName, forcePrefill, lists, nextMap);
              if (t.updated) results.templated.push(`${r.journal.name} (${t.reason})`);
              else results.skipped.push(`${r.journal.name} (${t.reason})`);
            }
          }

          // Auto-wire UUIDs across ALL ensured journals/pages
          results.autoWired = await autoWireAllEnsuredJournals(ensuredJournals);

          ui.journal.render(true);

          const list = (arr) => arr.length
            ? `<ul>${arr.map(x => `<li>${x}</li>`).join("")}</ul>`
            : "<p><em>None</em></p>";

          ChatMessage.create({
            content:
              `<b>${topFolderName}</b><hr>` +
              `<b>Created:</b> ${results.created.length} | <b>Moved:</b> ${results.moved.length} | <b>In place:</b> ${results.exists.length}<br>` +
              `<b>Jump rows normalized:</b> ${results.jumpUpdated.length}<br>` +
              `<b>Templates applied:</b> ${results.templated.length} | <b>Auto-wired:</b> ${results.autoWired.length}<hr>` +
              `<details><summary>Jump rows updated</summary>${list(results.jumpUpdated)}</details>` +
              `<details><summary>Auto-wired journals</summary>${list(results.autoWired)}</details>` +
              `<details><summary>Templates applied</summary>${list(results.templated)}</details>` +
              `<details><summary>Template skipped</summary>${list(results.skipped)}</details>`
          });

          ui.notifications.info(`Done. Jump rows updated: ${results.jumpUpdated.length}. Auto-wired: ${results.autoWired.length}.`);
        } catch (err) {
          console.error(err);
          ui.notifications.error(`Macro failed: ${err?.message ?? err}`);
        }
      }
    },
    cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel" }
  },
  default: "run"
}).render(true);
