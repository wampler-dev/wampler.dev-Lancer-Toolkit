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
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }
  return { stripStatusIconPrefix, isPacket, nowStamp, esc };
})();
/***** /OSR_LIB *****/

const FLAG_SCOPE="lancer";
const FLAG_SCENE_ID="packetSceneId";

const DEFAULT_PREFIX="OSR";
const DEFAULT_MISSION=1;
const DEFAULT_MISSION_NAME="The Drop";

// Default macro names (edit if yours differ)
const DEFAULT_MACROS = {
  openCurrent: "Open Current Packet (v2)",
  sessionLoop: "Session Loop — One Button (v4.1)",
  openScene: "Packet → Open Bound Scene (v1)",
  playerView: "Packet → Open Player View (v1)",
  threatPlus: "Threat — Advance (+) (v2)",
  threatPanel: "Threat — Control Panel (v2)",
  audit: "Packet — Audit & Repair (v2 + report)"
};

async function promptDashboard(){
  return new Promise(resolve=>{
    new Dialog({
      title:"Packet Dashboard — Build/Refresh (v8) [Scene-aware]",
      content:`
      <form>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="${DEFAULT_PREFIX}"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/></div>
        <div class="form-group"><label>Mission Name</label><input name="missionName" value="${DEFAULT_MISSION_NAME}"/></div>

        <hr>
        <h3>Dashboard Options</h3>
        <div class="form-group"><label><input type="checkbox" name="includeActions" checked/> Include Action Panel</label></div>
        <div class="form-group"><label><input type="checkbox" name="includeProgress" checked/> Include Progress Bar</label></div>
        <div class="form-group"><label><input type="checkbox" name="includeThreat" checked/> Include Threat Widget</label></div>

        <hr>
        <h3>Scenes</h3>
        <div class="form-group">
          <label><input type="checkbox" name="showSceneLinksEverywhere"/>
          Show Scene links in Upcoming/Completed lists too (default: off)</label>
        </div>

        <hr>
        <h3>Macro Links</h3>
        <p class="notes">These create clickable @Macro links on the Dashboard.</p>
        <div class="form-group"><label>Open/Refresh Dashboard</label><input name="dashSelf" value="Packet Dashboard — Build/Refresh (v8)"/></div>
        <div class="form-group"><label>Open Current</label><input name="openCurrent" value="${OSR_LIB.esc(DEFAULT_MACROS.openCurrent)}"/></div>
        <div class="form-group"><label>Session Loop</label><input name="sessionLoop" value="${OSR_LIB.esc(DEFAULT_MACROS.sessionLoop)}"/></div>
        <div class="form-group"><label>Open Scene</label><input name="openScene" value="${OSR_LIB.esc(DEFAULT_MACROS.openScene)}"/></div>
        <div class="form-group"><label>Player View</label><input name="playerView" value="${OSR_LIB.esc(DEFAULT_MACROS.playerView)}"/></div>
        <div class="form-group"><label>Threat +1</label><input name="threatPlus" value="${OSR_LIB.esc(DEFAULT_MACROS.threatPlus)}"/></div>
        <div class="form-group"><label>Threat Panel</label><input name="threatPanel" value="${OSR_LIB.esc(DEFAULT_MACROS.threatPanel)}"/></div>
        <div class="form-group"><label>Packet Audit</label><input name="audit" value="${OSR_LIB.esc(DEFAULT_MACROS.audit)}"/></div>
      </form>
      `,
      buttons:{
        ok:{icon:'<i class="fas fa-sync"></i>',label:"Build/Refresh",callback:html=>{
          const f = html[0].querySelector("form");
          resolve({
            prefix:f.prefix.value.trim(),
            mission:Number(f.mission.value),
            missionName:f.missionName.value.trim(),
            includeActions:!!f.includeActions.checked,
            includeProgress:!!f.includeProgress.checked,
            includeThreat:!!f.includeThreat.checked,
            showSceneLinksEverywhere:!!f.showSceneLinksEverywhere.checked,
            macros:{
              dashSelf:f.dashSelf.value.trim(),
              openCurrent:f.openCurrent.value.trim(),
              sessionLoop:f.sessionLoop.value.trim(),
              openScene:f.openScene.value.trim(),
              playerView:f.playerView.value.trim(),
              threatPlus:f.threatPlus.value.trim(),
              threatPanel:f.threatPanel.value.trim(),
              audit:f.audit.value.trim()
            }
          });
        }},
        cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel",callback:()=>resolve(null)}
      },
      default:"ok"
    }).render(true);
  });
}

function uuidLink(j){
  return `@UUID[JournalEntry.${j.id}]{${j.name}}`;
}
function sceneLinkFromPacket(j){
  const sid = j.getFlag(FLAG_SCOPE, FLAG_SCENE_ID);
  if (!sid) return "";
  const s = game.scenes.get(sid);
  if (!s) return "";
  return `@UUID[Scene.${s.id}]{${s.name}}`;
}
function macroLink(name, label){
  if (!name) return "";
  return `@Macro[${name}]{${label}}`;
}
async function getOrCreateFirstTextPage(journal, pageName="Dashboard"){
  const existing = journal.pages?.contents?.find(p=>p.type==="text");
  if (existing) return existing;
  const [p] = await journal.createEmbeddedDocuments("JournalEntryPage",[{name:pageName,type:"text",text:{content:""}}]);
  return p;
}

// ---------------- MAIN ----------------
const cfg = await promptDashboard();
if (!cfg) return;

const M = `M${cfg.mission}`;
const tagPrefix = `${cfg.prefix} ${M} `;

const dashboardName = `${cfg.prefix} ${M} — Packet Dashboard: ${cfg.missionName}`;
const overviewName  = `${cfg.prefix} ${M} — Mission Overview: ${cfg.missionName}`;
const debriefName   = `${cfg.prefix} ${M} — Mission Debrief: ${cfg.missionName}`;
const threatName    = `${cfg.prefix} ${M} — Threat Console: ${cfg.missionName}`;
const questName     = `${cfg.prefix} ${M} — Simple Quest: ${cfg.missionName}`;

let dashboard = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === dashboardName);
const overview = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === overviewName);
const debrief  = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === debriefName);
const threatJ  = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === threatName);
const questJ   = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === questName);

if (!dashboard) {
  dashboard = await JournalEntry.create({
    name: dashboardName,
    pages: [{ name:"Dashboard", type:"text", text:{ content:"" } }]
  });
}

const page = await getOrCreateFirstTextPage(dashboard, "Dashboard");

// Packets in scope
const packets = game.journal.contents
  .filter(j=>{
    const clean = OSR_LIB.stripStatusIconPrefix(j.name);
    return clean.startsWith(tagPrefix) && OSR_LIB.isPacket(clean);
  })
  .map(j=>({
    j,
    status: j.getFlag("lancer","packetStatus") ?? "upcoming",
    current: j.getFlag("lancer","currentPacket") === true
  }))
  .sort((a,b)=>OSR_LIB.stripStatusIconPrefix(a.j.name).localeCompare(OSR_LIB.stripStatusIconPrefix(b.j.name)));

const currentPacket = packets.find(p=>p.current) ?? null;
const active = packets.filter(p=>p.status==="active");
const upcoming = packets.filter(p=>(p.status ?? "upcoming")==="upcoming");
const completed = packets.filter(p=>p.status==="completed");

const total = packets.length || 1;
const pct = Math.round((completed.length / total) * 100);

// Threat widget
let threatLine = "—";
let threatLog = [];
if (cfg.includeThreat && threatJ) {
  const state = threatJ.getFlag("lancer","threatState");
  if (state) {
    threatLine = `${state.level} / ${state.max}`;
    threatLog = (state.log ?? []).slice(-3).reverse();
  }
}

// Jump row
const jumpParts = [];
if (overview) jumpParts.push(`@UUID[JournalEntry.${overview.id}]{${overviewName}}`);
if (dashboard) jumpParts.push(`@UUID[JournalEntry.${dashboard.id}]{${dashboardName}}`);
if (questJ) jumpParts.push(`@UUID[JournalEntry.${questJ.id}]{${questName}}`);
if (debrief) jumpParts.push(`@UUID[JournalEntry.${debrief.id}]{${debriefName}}`);
if (threatJ) jumpParts.push(`@UUID[JournalEntry.${threatJ.id}]{${threatName}}`);

const jumpRow = jumpParts.length
  ? `<p><strong>Jump:</strong> ${jumpParts.join(" &nbsp;•&nbsp; ")}</p>`
  : "";

// Actions
const actions = [];
if (cfg.includeActions) {
  const m = cfg.macros;
  const row1 = [
    macroLink(m.dashSelf, "Refresh Dashboard"),
    macroLink(m.openCurrent, "Open Current"),
    macroLink(m.openScene, "Open Scene"),
    macroLink(m.sessionLoop, "Session Loop"),
    macroLink(m.playerView, "Player View")
  ].filter(Boolean);

  const row2 = [
    macroLink(m.threatPlus, "Threat +1"),
    macroLink(m.threatPanel, "Threat Panel"),
    macroLink(m.audit, "Packet Audit")
  ].filter(Boolean);

  if (row1.length) actions.push(`<p><strong>Actions:</strong> ${row1.join(" &nbsp;•&nbsp; ")}</p>`);
  if (row2.length) actions.push(`<p>${row2.join(" &nbsp;•&nbsp; ")}</p>`);
}

// Progress bar
const progress = cfg.includeProgress
  ? `
  <h2>Progress</h2>
  <p><strong>${completed.length}</strong> / ${packets.length} completed (${pct}%)</p>
  <div style="border:1px solid #888; border-radius:6px; padding:2px;">
    <div style="width:${pct}%; height:14px; border-radius:4px;"></div>
  </div>
  `
  : "";

// Render lists with optional scene links
function renderList(title, list, includeScenes, extra){
  if (!list.length) return `<h2>${OSR_LIB.esc(title)}</h2><p><em>None</em></p>`;
  return `
  <h2>${OSR_LIB.esc(title)}</h2>
  <ul>
    ${list.map(p=>{
      const tag = extra?.(p) ?? "";
      const sLink = includeScenes ? sceneLinkFromPacket(p.j) : "";
      const sSpan = sLink ? ` <span style="opacity:0.85;">(Scene: ${sLink})</span>` : "";
      return `<li>${uuidLink(p.j)}${tag}${sSpan}</li>`;
    }).join("")}
  </ul>`;
}

const currentSceneLink = currentPacket ? sceneLinkFromPacket(currentPacket.j) : "";

const currentBlock = `
<h2>Current Packet</h2>
${currentPacket
  ? `<p>${uuidLink(currentPacket.j)}</p>
     <p><strong>Scene:</strong> ${currentSceneLink || "<em>(none bound)</em>"}</p>`
  : `<p><em>(none set)</em></p>`}
`.trim();

const threatBlock = cfg.includeThreat
  ? `
<h2>Threat</h2>
<p><strong>${OSR_LIB.esc(threatLine)}</strong></p>
${threatJ ? `<p>${uuidLink(threatJ)}</p>` : ""}
${threatLog.length ? `<h3>Recent Threat Log</h3><ul>${threatLog.map(x=>`<li>${OSR_LIB.esc(x)}</li>`).join("")}</ul>` : `<p><em>No threat log entries yet.</em></p>`}
`
  : "";

const html = `
<h1>${OSR_LIB.esc(dashboardName)}</h1>
<p><em>Updated: ${OSR_LIB.esc(OSR_LIB.nowStamp())}</em></p>

${jumpRow}

${actions.join("\n")}

${progress}

${currentBlock}

${threatBlock}

<hr>
<h2>Packets</h2>

${renderList("Active", active, true, p => p.current ? " <strong>(CURRENT)</strong>" : "")}
${renderList("Upcoming", upcoming, cfg.showSceneLinksEverywhere)}
${renderList("Completed", completed, cfg.showSceneLinksEverywhere)}
`.trim();

await page.update({ "text.content": html });
dashboard.sheet.render(true);

ui.notifications.info(`Dashboard refreshed: ${cfg.prefix} ${M}`);
