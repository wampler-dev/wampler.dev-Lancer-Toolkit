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
  function isPacket(cleanName){ return /\b(B|C)\d+\b/.test(cleanName); }
  function nowStamp(){ return new Date().toLocaleString(); }
  return { stripStatusIconPrefix, isPacket, nowStamp };
})();
/***** /OSR_LIB *****/

const DEFAULT_PREFIX="OSR", DEFAULT_MISSION=1, DEFAULT_MISSION_NAME="The Drop";
const ICONS = { upcoming: "⏳", active: "▶️", completed: "✅" };

async function promptAudit(){
  return new Promise(resolve=>{
    new Dialog({
      title:"Packet — Audit & Repair (v2.1 Meta-aware)",
      content:`
      <form>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="${DEFAULT_PREFIX}"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/></div>
        <div class="form-group"><label>Mission Name (for Meta folder + report journal)</label><input name="missionName" value="${DEFAULT_MISSION_NAME}"/></div>
        <hr>
        <div class="form-group"><label><input type="checkbox" name="fixMissingStatus" checked/> Fix missing packetStatus → upcoming</label></div>
        <div class="form-group"><label><input type="checkbox" name="enforceSingleCurrent" checked/> Enforce single Current (keep first, clear others)</label></div>
        <div class="form-group"><label><input type="checkbox" name="enforceSingleActive" /> Enforce single Active (keep first, set others to upcoming)</label></div>
        <div class="form-group"><label><input type="checkbox" name="syncIcons" checked/> Sync name icons to flags (idempotent)</label></div>
        <hr>
        <div class="form-group"><label><input type="checkbox" name="writeReport" checked/> Write HTML report journal</label></div>
        <div class="form-group"><label><input type="checkbox" name="openReport" checked/> Open report when done</label></div>
      </form>`,
      buttons:{
        ok:{icon:'<i class="fas fa-search"></i>',label:"Audit",callback:html=>{
          const f=html[0].querySelector("form");
          resolve({
            prefix:f.prefix.value.trim(),
            mission:Number(f.mission.value),
            missionName:f.missionName.value.trim(),
            fixMissingStatus:!!f.fixMissingStatus.checked,
            enforceSingleCurrent:!!f.enforceSingleCurrent.checked,
            enforceSingleActive:!!f.enforceSingleActive.checked,
            syncIcons:!!f.syncIcons.checked,
            writeReport:!!f.writeReport.checked,
            openReport:!!f.openReport.checked
          });
        }},
        cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel",callback:()=>resolve(null)}
      },
      default:"ok"
    }).render(true);
  });
}

function statusFromName(name){
  const s = String(name ?? "");
  if (/^✅/u.test(s)) return "completed";
  if (/^⏳/u.test(s)) return "upcoming";
  if (/^▶/u.test(s)) return "active";
  return null;
}

async function syncIconToStatus(journal, status){
  const base = OSR_LIB.stripStatusIconPrefix(journal.name);
  const icon = ICONS[status] ?? ICONS.upcoming;
  const newName = `${icon} ${base}`;
  if (newName !== journal.name) await journal.update({ name: newName });
}

async function getOrCreateFirstTextPage(journal, pageName="Report"){
  const existing = journal.pages?.contents?.find(p=>p.type==="text");
  if (existing) return existing;
  const [p] = await journal.createEmbeddedDocuments("JournalEntryPage",[{name:pageName,type:"text",text:{content:""}}]);
  return p;
}

async function getV9MetaFolder(prefix, M, missionName, { allowCreate = false } = {}) {
  // Prefer: Mission Overview's folder (most reliable because v9 generator makes it)
  const overviewName = `${prefix} ${M} — Mission Overview: ${missionName}`;
  const overview = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === overviewName);
  if (overview?.folder) return overview.folder;

  // Fallback: locate top mission folder then "Meta" subfolder
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

  return await Folder.create({ name:"Meta", type:"JournalEntry", folder: top.id, sorting:"a" });
}

function uuidLink(journalName, journalId) {
  return `@UUID[JournalEntry.${journalId}]{${journalName}}`;
}

function htmlEscape(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;");
}

function buildNameToUuidMap(journals) {
  const map = new Map();
  for (const j of journals) {
    const uuid = `JournalEntry.${j.id}`;
    const raw = j.name;
    const clean = OSR_LIB.stripStatusIconPrefix(j.name);
    for (const k of [raw, raw?.trim?.(), clean, clean?.trim?.()]) if (k) map.set(String(k), uuid);
  }
  return map;
}

function rewriteUuids(content, nameToUuid) {
  const regex = /@UUID\[\s*JournalEntry\.[^\]]+\s*\]\{([^}]+)\}/g;
  return (content ?? "").replace(regex, (match, label) => {
    const key = String(label).trim();
    const uuid = nameToUuid.get(key);
    return uuid ? `@UUID[${uuid}]{${label}}` : match;
  });
}

function findJournalByCleanName(cleanName){
  return game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === cleanName) ?? null;
}

function renderReportHtml(cfg, stats, packetsRows, anomalies, quickLinksHtml) {
  const { prefix, mission, missionName } = cfg;
  const M = `M${mission}`;
  const ts = OSR_LIB.nowStamp();

  const anomalyBlock = anomalies.length
    ? `<ul>${anomalies.map(a=>`<li>${htmlEscape(a)}</li>`).join("")}</ul>`
    : `<p><em>None</em></p>`;

  return `
<h1>${prefix} ${M} — Packet Audit Report: ${missionName}</h1>
<p><em>Generated: ${ts}</em></p>
<hr>

<h2>Quick Links</h2>
${quickLinksHtml}
<hr>

<h2>Summary</h2>
<ul>
  <li><strong>Packets scanned:</strong> ${stats.total}</li>
  <li><strong>Current flags:</strong> ${stats.currents}</li>
  <li><strong>Active:</strong> ${stats.active} | <strong>Upcoming:</strong> ${stats.upcoming} | <strong>Completed:</strong> ${stats.completed}</li>
  <li><strong>Missing packetStatus:</strong> ${stats.missingStatus}</li>
  <li><strong>Icon mismatches:</strong> ${stats.iconMismatch}</li>
  <li><strong>Repairs applied:</strong> ${stats.repairsApplied}</li>
</ul>

<h2>Anomalies / Notes</h2>
${anomalyBlock}

<h2>Packets</h2>
<table>
  <thead>
    <tr>
      <th>Link</th>
      <th>Status Flag</th>
      <th>Current?</th>
      <th>Name Icon</th>
    </tr>
  </thead>
  <tbody>
    ${packetsRows.join("\n")}
  </tbody>
</table>

<p class="notes"><em>Tip:</em> If this report ever shows Current=0 but you expect one, run Set Current Packet (v2) then Packet → Mark Active (v4), then rerun this audit.</p>
`.trim();
}

function buildQuickLinksHtml(prefix, M, missionName){
  const dashboardName = `${prefix} ${M} — Packet Dashboard: ${missionName}`;
  const overviewName  = `${prefix} ${M} — Mission Overview: ${missionName}`;
  const debriefName   = `${prefix} ${M} — Mission Debrief: ${missionName}`;

  const dash = findJournalByCleanName(dashboardName);
  const over = findJournalByCleanName(overviewName);
  const deb  = findJournalByCleanName(debriefName);

  function li(j, label){
    if (!j) return `<li><em>(missing)</em> ${htmlEscape(label)}</li>`;
    return `<li>@UUID[JournalEntry.${j.id}]{${htmlEscape(label)}}</li>`;
  }

  return `
<ul>
  ${li(dash, dashboardName)}
  ${li(over, overviewName)}
  ${li(deb,  debriefName)}
</ul>`.trim();
}

// ---------------- MAIN ----------------
const cfg = await promptAudit();
if (!cfg) return;

const M = `M${cfg.mission}`;
const tagPrefix = `${cfg.prefix} ${M} `;

const packets = game.journal.contents
  .filter(j=>{
    const clean = OSR_LIB.stripStatusIconPrefix(j.name);
    return clean.startsWith(tagPrefix) && OSR_LIB.isPacket(clean);
  })
  .map(j=>{
    const clean = OSR_LIB.stripStatusIconPrefix(j.name);
    return {
      j,
      id: j.id,
      name: j.name,
      clean,
      status: j.getFlag("lancer","packetStatus"),
      isCurrent: j.getFlag("lancer","currentPacket") === true,
      iconStatus: statusFromName(j.name)
    };
  })
  .sort((a,b)=>a.clean.localeCompare(b.clean));

if (!packets.length) {
  ui.notifications.warn(`No packets found for "${cfg.prefix} ${M}".`);
  return;
}

// Findings
const missingStatus = packets.filter(p => !p.status);
const active = packets.filter(p => p.status === "active");
const completed = packets.filter(p => p.status === "completed");
const upcoming = packets.filter(p => (p.status ?? "upcoming") === "upcoming");
const currents = packets.filter(p => p.isCurrent);

const iconMismatch = packets.filter(p => {
  const effective = p.status ?? "upcoming";
  return p.iconStatus !== effective;
});

const anomalies = [];
if (currents.length === 0) anomalies.push("No Current Packet flag set.");
if (currents.length > 1) anomalies.push(`Multiple currentPacket flags set (${currents.length}).`);
if (active.length > 1) anomalies.push(`Multiple active packetStatus entries (${active.length}).`);
if (missingStatus.length) anomalies.push(`Missing packetStatus on ${missingStatus.length} packet(s).`);
if (iconMismatch.length) anomalies.push(`Icon mismatch on ${iconMismatch.length} packet(s) (name prefix vs packetStatus flag).`);

// Repairs
let repairsApplied = 0;

// 1) Fix missing status
if (cfg.fixMissingStatus) {
  for (const p of missingStatus) {
    await p.j.setFlag("lancer","packetStatus","upcoming");
    p.status = "upcoming";
    repairsApplied++;
  }
}

// 2) Enforce single current
if (cfg.enforceSingleCurrent && currents.length > 1) {
  for (let i=1;i<currents.length;i++) {
    await currents[i].j.unsetFlag("lancer","currentPacket");
    repairsApplied++;
  }
}

// 3) Enforce single active
if (cfg.enforceSingleActive && active.length > 1) {
  for (let i=1;i<active.length;i++) {
    await active[i].j.setFlag("lancer","packetStatus","upcoming");
    repairsApplied++;
  }
}

// 4) Sync icons
if (cfg.syncIcons) {
  for (const p of packets) {
    const effective = p.j.getFlag("lancer","packetStatus") ?? "upcoming";
    await syncIconToStatus(p.j, effective);
  }
  repairsApplied++;
}

// Recompute stats after repairs
const packetsNow = packets.map(p => ({
  id: p.id,
  name: p.j.name,
  status: p.j.getFlag("lancer","packetStatus") ?? "upcoming",
  isCurrent: p.j.getFlag("lancer","currentPacket") === true,
  iconStatus: statusFromName(p.j.name) ?? "(none)"
}));

const stats = {
  total: packetsNow.length,
  currents: packetsNow.filter(p=>p.isCurrent).length,
  active: packetsNow.filter(p=>p.status==="active").length,
  upcoming: packetsNow.filter(p=>p.status==="upcoming").length,
  completed: packetsNow.filter(p=>p.status==="completed").length,
  missingStatus: packetsNow.filter(p=>!p.status).length,
  iconMismatch: packetsNow.filter(p=>p.iconStatus !== p.status).length,
  repairsApplied
};

// Build rows
const packetsRows = packetsNow.map(p => {
  return `<tr>
    <td>${uuidLink(p.name, p.id)}</td>
    <td>${htmlEscape(p.status)}</td>
    <td>${p.isCurrent ? "<strong>YES</strong>" : "no"}</td>
    <td>${htmlEscape(p.iconStatus)}</td>
  </tr>`;
});

// Console report too
console.groupCollapsed(`Packet Audit — ${cfg.prefix} ${M}`);
console.table(packetsNow);
console.groupEnd();

ui.notifications.info(`Packet Audit: packets=${stats.total} | current=${stats.currents} | active=${stats.active} | repairs=${stats.repairsApplied}`);

// Write HTML report journal
if (cfg.writeReport) {
  const metaFolder = await getV9MetaFolder(cfg.prefix, M, cfg.missionName, { allowCreate: false });

  if (!metaFolder) {
    ui.notifications.warn("Audit report: Meta folder not found (run Mission Journal Generator v9 first). Report will be created at root.");
  }

  const reportName = `${cfg.prefix} ${M} — Packet Audit Report: ${cfg.missionName}`;
  let report = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === reportName);

  if (!report) {
    report = await JournalEntry.create({
      name: reportName,
      folder: metaFolder?.id ?? null,
      pages: [{ name: "Report", type: "text", text: { content: "" } }]
    });
  } else if (metaFolder && report.folder?.id !== metaFolder.id) {
    await report.update({ folder: metaFolder.id });
  }

  const page = await getOrCreateFirstTextPage(report, "Report");
  const nameToUuid = buildNameToUuidMap(game.journal.contents);

  const quickLinksHtml = buildQuickLinksHtml(cfg.prefix, M, cfg.missionName);

  let html = renderReportHtml(cfg, stats, packetsRows, anomalies, quickLinksHtml);

  // Also repair any stale journal UUIDs by label
  html = rewriteUuids(html, nameToUuid);

  await page.update({ "text.content": html });

  if (cfg.openReport) report.sheet.render(true);
}
