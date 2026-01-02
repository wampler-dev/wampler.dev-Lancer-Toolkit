/***** OSR_LIB (shared helpers) *****/
const OSR_LIB = (() => {
  const INVIS = "\u200B\u200C\u200D\u2060\uFE0F\uFEFF";
  function stripStatusIconPrefix(name) {
    let s = String(name ?? "");
    const junk = `[\\s${INVIS}]*`;
    const icon = `(?:⏳|✅|▶)`;
    const vs16 = `(?:\\uFE0F)?`;
    const re = new RegExp(`^${icon}${vs16}${junk}`, "u");
    while (re.test(s)) s = s.replace(re, "");
    s = s.replace(new RegExp(`^${junk}`, "u"), "");
    return s;
  }
  function nowStamp() { return new Date().toLocaleString(); }
  return { stripStatusIconPrefix, nowStamp };
})();
/***** /OSR_LIB *****/

const DEFAULT_PREFIX = "OSR";
const DEFAULT_MISSION = 1;
const DEFAULT_MISSION_NAME = "The Drop";
const DEFAULT_MAX = 6;
const DEFAULT_START = 0;

async function promptSetup() {
  return new Promise(resolve => {
    new Dialog({
      title: "Threat Console — Ensure / Refresh (v4)",
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
            <label>Mission Name</label>
            <input type="text" name="missionName" value="${DEFAULT_MISSION_NAME}"/>
          </div>
          <hr>
          <div class="form-group">
            <label>Max Threat</label>
            <input type="number" name="max" value="${DEFAULT_MAX}" min="1" step="1"/>
          </div>
          <div class="form-group">
            <label>Start Threat</label>
            <input type="number" name="start" value="${DEFAULT_START}" min="0" step="1"/>
          </div>
        </form>
      `,
      buttons: {
        ok: { icon: '<i class="fas fa-check"></i>', label: "Ensure Console", callback: html => {
          const f = html[0].querySelector("form");
          resolve({
            prefix: f.prefix.value.trim(),
            mission: Number(f.mission.value),
            missionName: f.missionName.value.trim(),
            max: Math.max(1, Number(f.max.value)),
            start: Math.max(0, Number(f.start.value))
          });
        }},
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok"
    }).render(true);
  });
}

async function getV9MetaFolder(prefix, M, missionName, { allowCreate = true } = {}) {
  const overviewName = `${prefix} ${M} — Mission Overview: ${missionName}`;
  const overview = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === overviewName);
  if (overview?.folder) return overview.folder;

  const topName = `${prefix} ${M} — ${missionName}`;
  const top = game.folders.find(f => f.type === "JournalEntry" && f.name === topName && !f.folder);
  if (!top) return null;

  const metas = game.folders.filter(f =>
    f.type === "JournalEntry" &&
    f.name === "Meta" &&
    (f.folder?.id === top.id || f.folderId === top.id)
  );
  if (metas.length) return metas[0];
  if (!allowCreate) return null;

  return await Folder.create({ name: "Meta", type: "JournalEntry", folder: top.id, sorting: "a" });
}

async function getOrCreateFirstTextPage(journal) {
  const existingText = journal.pages?.contents?.find(p => p.type === "text");
  if (existingText) return existingText;
  const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
    name: "Console", type: "text", text: { content: "" }
  }]);
  return page;
}

function renderConsoleHtml(tag, state) {
  const pct = state.max > 0 ? Math.round((state.level / state.max) * 100) : 0;
  const log = (state.log ?? []).slice(-12).reverse();
  return `
<h1>${tag} — Threat Console</h1>
<p><em>Updated: ${state.updatedAt || OSR_LIB.nowStamp()}</em></p>
<hr>
<h2>Current Threat</h2>
<p style="font-size:1.25em;"><strong>${state.level}</strong> / ${state.max} (${pct}%)</p>
<hr>
<h2>Recent Log</h2>
${log.length ? `<ul>${log.map(x => `<li>${x}</li>`).join("")}</ul>` : `<p><em>No log entries yet.</em></p>`}
`.trim();
}

const cfg = await promptSetup();
if (!cfg) return;

const M = `M${cfg.mission}`;
const metaFolder = await getV9MetaFolder(cfg.prefix, M, cfg.missionName, { allowCreate: true });
if (!metaFolder) { ui.notifications.error("Could not locate v9 Meta folder."); return; }

const consoleName = `${cfg.prefix} ${M} — Threat Console: ${cfg.missionName}`;
let journal = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === consoleName);

if (!journal) {
  journal = await JournalEntry.create({
    name: consoleName,
    folder: metaFolder.id,
    pages: [{ name: "Console", type: "text", text: { content: "" } }]
  });
} else if (journal.folder?.id !== metaFolder.id) {
  await journal.update({ folder: metaFolder.id });
}

const state = journal.getFlag("lancer","threatState") ?? { level: cfg.start, max: cfg.max, updatedAt: OSR_LIB.nowStamp(), log: [] };
state.max = Math.max(1, cfg.max ?? state.max ?? DEFAULT_MAX);
state.level = Math.min(Math.max(0, state.level ?? cfg.start ?? 0), state.max);
state.updatedAt = OSR_LIB.nowStamp();

await journal.setFlag("lancer","threatState", state);

const page = await getOrCreateFirstTextPage(journal);
await page.update({ "text.content": renderConsoleHtml(`${cfg.prefix} ${M}`, state) });

journal.sheet.render(true);
ui.notifications.info(`Threat Console ready: ${consoleName}`);
