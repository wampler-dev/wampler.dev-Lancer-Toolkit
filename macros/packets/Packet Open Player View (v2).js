// Packet → Open Player View (v2) [Meta-aware]

/***** OSR_LIB *****/
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
  function isPacket(clean){ return /\b(B|C)\d+\b/.test(clean); }
  return { stripStatusIconPrefix, isPacket };
})();
/***** /OSR_LIB *****/

const DEFAULT_PREFIX = "OSR";
const DEFAULT_MISSION = 1;
const PLAYER_VIEW_NAME = "Player View (Auto)";

function findMissionMetaFolder(prefix, mission, missionNameGuess=null){
  // If missionNameGuess is unknown, try "any folder matching prefix+mission" and use its Meta subfolder
  const rootPrefix = `${prefix} M${mission} — `;
  const roots = game.folders.contents.filter(f => f.type==="JournalEntry" && f.name.startsWith(rootPrefix));
  const root = roots[0] ?? null;
  if (!root) return null;
  const meta = game.folders.contents.find(f => f.type==="JournalEntry" && f.name==="Meta" && f.folder?.id===root.id) ?? null;
  return meta;
}

function stripForPlayers(html) {
  let out = String(html ?? "");
  out = out.replace(/<p[^>]*>[\s\S]*?@UUID\[[\s\S]*?@UUID\[[\s\S]*?<\/p>/i, "");
  out = out.replace(/<h2[^>]*>\s*Next\s*Packet\s*<\/h2>[\s\S]*?(?=<h2|$)/i, "");
  out = out.replace(/<section[^>]*data-lancer-gm\s*=\s*["']1["'][^>]*>[\s\S]*?<\/section>/gi, "");
  return out.trim();
}

async function getOrCreateFirstTextPage(journal) {
  const p = journal.pages?.contents?.find(x=>x.type==="text");
  if (p) return p;
  const [page] = await journal.createEmbeddedDocuments("JournalEntryPage",[{
    name:"Player View", type:"text", text:{ content:"" }
  }]);
  return page;
}

// --- MAIN ---
const current = game.journal.contents.find(j => j.getFlag("lancer","currentPacket") === true);
if (!current) { ui.notifications.warn("Player View: No Current Packet set."); return; }

const clean = OSR_LIB.stripStatusIconPrefix(current.name);
if (!OSR_LIB.isPacket(clean)) { ui.notifications.warn(`Player View: Current journal is not a packet: "${current.name}"`); return; }

// scope from name
const m = clean.match(/^([A-Za-z0-9]+)\s+M(\d+)\b/);
const prefix = m?.[1] ?? DEFAULT_PREFIX;
const mission = Number(m?.[2] ?? DEFAULT_MISSION);

// Pull content
let combined = "";
for (const p of current.pages?.contents ?? []) {
  if (p.type !== "text") continue;
  combined += "\n" + stripForPlayers(p.text?.content ?? "");
}
if (!combined.trim()) { ui.notifications.warn("Player View: No visible content found."); return; }

const viewName = `${prefix} M${mission} — ${PLAYER_VIEW_NAME}`;
let view = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === viewName);

// Meta reuse
const metaFolder = findMissionMetaFolder(prefix, mission);

if (!view) {
  view = await JournalEntry.create({
    name: viewName,
    folder: metaFolder?.id ?? null,
    pages: [{ name:"Player View", type:"text", text:{ content:"" } }]
  });
} else if (metaFolder && view.folder?.id !== metaFolder.id) {
  await view.update({ folder: metaFolder.id });
}

const page = await getOrCreateFirstTextPage(view);
await page.update({ "text.content": combined });

view.sheet.render(true);
ui.notifications.info(`Player View updated from ${current.name}`);
