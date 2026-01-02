/**
 * Meta Cleanup Utility (v9-anchored, safe)
 *
 * What it does:
 *  1) Prompts for Prefix + Mission # + Mission Name
 *  2) Finds the v9 "real" Meta folder by anchoring to Mission Overview's folder
 *  3) Finds ALL other "Meta" folders under the mission root
 *  4) Reports what it found and what it will do
 *  5) Optionally:
 *     - Move journals from duplicate Meta folders into the v9 Meta folder
 *     - Delete duplicate Meta folders that are empty after moves
 *
 * Safety:
 *  - No deletions without explicit confirmation
 *  - Only touches folders named exactly "Meta" under the specified mission root folder
 */

const DEFAULT_PREFIX = "OSR";
const DEFAULT_MISSION = 1;
const DEFAULT_MISSION_NAME = "The Drop";

function stripStatusIconPrefix(name) {
  return String(name).replace(/^[⏳▶️✅]\s*/u, "").trimStart();
}

async function promptScopeAndActions() {
  return new Promise(resolve => {
    new Dialog({
      title: "Meta Folder Cleanup (v9 anchored)",
      content: `
        <form>
          <div class="form-group">
            <label>Module Prefix</label>
            <input type="text" name="prefix" value="${DEFAULT_PREFIX}"/>
          </div>
          <div class="form-group">
            <label>Mission #</label>
            <input type="number" name="mission" value="${DEFAULT_MISSION}" min="1" step="1"/>
          </div>
          <div class="form-group">
            <label>Mission Name (must match v9 folder)</label>
            <input type="text" name="missionName" value="${DEFAULT_MISSION_NAME}"/>
          </div>
          <hr>
          <div class="form-group">
            <label><input type="checkbox" name="move" checked /> Move journals into v9 Meta</label>
          </div>
          <div class="form-group">
            <label><input type="checkbox" name="deleteEmpty" checked /> Delete duplicate Meta folders if empty</label>
          </div>
          <p class="notes">
            This tool only affects folders named <code>Meta</code> under the mission root folder:
            <code>PREFIX M# — Mission Name</code>.
          </p>
        </form>
      `,
      buttons: {
        scan: {
          icon: '<i class="fas fa-search"></i>',
          label: "Scan",
          callback: html => {
            const f = html[0].querySelector("form");
            resolve({
              prefix: f.prefix.value.trim(),
              mission: Number(f.mission.value),
              missionName: f.missionName.value.trim(),
              move: !!f.move.checked,
              deleteEmpty: !!f.deleteEmpty.checked
            });
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
      },
      default: "scan"
    }).render(true);
  });
}

async function confirmPlan(html, buttonLabel = "Proceed") {
  return new Promise(resolve => {
    new Dialog({
      title: "Confirm Meta Cleanup Plan",
      content: html,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: buttonLabel, callback: () => resolve(true) },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(false) }
      },
      default: "cancel"
    }).render(true);
  });
}

// v9 anchor: use Mission Overview's folder as the authoritative Meta folder
function getV9MetaFolder(prefix, M, missionName) {
  const overviewName = `${prefix} ${M} — Mission Overview: ${missionName}`;
  const overview = game.journal.find(j => stripStatusIconPrefix(j.name) === overviewName);
  return overview?.folder ?? null;
}

function getMissionRootFolder(prefix, M, missionName) {
  const topName = `${prefix} ${M} — ${missionName}`;
  return game.folders.find(f => f.type === "JournalEntry" && f.name === topName && !f.folder) ?? null;
}

function getMetaFoldersUnderRoot(rootId) {
  return game.folders.filter(f =>
    f.type === "JournalEntry" &&
    f.name === "Meta" &&
    (f.folder?.id === rootId || f.folderId === rootId)
  );
}

function journalsInFolder(folderId) {
  return game.journal.contents.filter(j => j.folder?.id === folderId);
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const cfg = await promptScopeAndActions();
if (!cfg) return;

const M = `M${cfg.mission}`;
const root = getMissionRootFolder(cfg.prefix, M, cfg.missionName);
if (!root) {
  ui.notifications.error(`Mission root folder not found: "${cfg.prefix} ${M} — ${cfg.missionName}"`);
  return;
}

const v9Meta = getV9MetaFolder(cfg.prefix, M, cfg.missionName);
if (!v9Meta) {
  ui.notifications.error(`Couldn't locate v9 Meta folder (Mission Overview missing or not in a folder).`);
  return;
}

const metas = getMetaFoldersUnderRoot(root.id);
if (!metas.length) {
  ui.notifications.warn(`No "Meta" folders found under mission root. Nothing to do.`);
  return;
}

const duplicates = metas.filter(f => f.id !== v9Meta.id);

const v9Count = journalsInFolder(v9Meta.id).length;
const dupInfo = duplicates.map(f => ({
  folder: f,
  count: journalsInFolder(f.id).length
}));

const planMoves = [];
if (cfg.move) {
  for (const d of dupInfo) {
    for (const j of journalsInFolder(d.folder.id)) {
      planMoves.push({ journal: j, from: d.folder, to: v9Meta });
    }
  }
}

const willDelete = [];
if (cfg.deleteEmpty) {
  // We only delete folders that are empty after planned moves
  for (const d of dupInfo) {
    const currentCount = journalsInFolder(d.folder.id).length;
    const movedCount = cfg.move ? currentCount : 0;
    const remaining = currentCount - movedCount;
    if (remaining === 0) willDelete.push(d.folder);
  }
}

// Build scan report
const reportHtml = `
  <p><strong>Mission:</strong> ${esc(cfg.prefix)} ${esc(M)} — ${esc(cfg.missionName)}</p>
  <p><strong>Mission Root Folder:</strong> ${esc(root.name)}</p>
  <hr>
  <p><strong>v9 Meta Folder (anchor):</strong> ${esc(v9Meta.name)} <em>(journals inside: ${v9Count})</em></p>
  <p><strong>Duplicate Meta Folders Found:</strong> ${duplicates.length}</p>
  ${duplicates.length ? `
    <ul>
      ${dupInfo.map(d => `<li>${esc(d.folder.name)} (id: ${esc(d.folder.id)}) — journals inside: ${d.count}</li>`).join("")}
    </ul>
  ` : `<p><em>No duplicates.</em></p>`}
  <hr>
  <p><strong>Planned Actions:</strong></p>
  <ul>
    <li>Move journals into v9 Meta: <strong>${cfg.move ? "YES" : "NO"}</strong> (moves: ${planMoves.length})</li>
    <li>Delete duplicate Meta folders if empty: <strong>${cfg.deleteEmpty ? "YES" : "NO"}</strong> (folders to delete: ${willDelete.length})</li>
  </ul>
  ${planMoves.length ? `
    <details>
      <summary>Show journal moves (${planMoves.length})</summary>
      <ul>
        ${planMoves.slice(0, 50).map(m => `<li>${esc(m.journal.name)} → ${esc(v9Meta.name)}</li>`).join("")}
      </ul>
      ${planMoves.length > 50 ? `<p><em>Showing first 50 moves.</em></p>` : ""}
    </details>
  ` : ""}
  ${willDelete.length ? `
    <p style="color:#b00;"><strong>Deletion will remove folder documents</strong> (only empty duplicates). Journals are not deleted.</p>
  ` : ""}
`;

const ok = await confirmPlan(reportHtml, "Execute Cleanup");
if (!ok) {
  ui.notifications.info("Meta cleanup cancelled.");
  return;
}

// Execute moves
let moved = 0;
if (cfg.move && planMoves.length) {
  for (const m of planMoves) {
    // Skip if already in v9 meta
    if (m.journal.folder?.id === v9Meta.id) continue;
    await m.journal.update({ folder: v9Meta.id });
    moved++;
  }
}

// Recompute empties and delete
let deleted = 0;
if (cfg.deleteEmpty && duplicates.length) {
  for (const f of duplicates) {
    const count = journalsInFolder(f.id).length;
    if (count === 0) {
      await f.delete();
      deleted++;
    }
  }
}

ui.notifications.info(`Meta cleanup complete. Journals moved: ${moved}. Meta folders deleted: ${deleted}.`);
