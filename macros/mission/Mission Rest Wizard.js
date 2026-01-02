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

const ICONS = { upcoming: "⏳", active: "▶️", completed: "✅" };

const DEFAULT_PREFIX="OSR";
const DEFAULT_MISSION=1;
const DEFAULT_MISSION_NAME="The Drop";
const DEFAULT_THREAT_MAX=6;

async function promptResetWizard(){
  return new Promise(resolve=>{
    new Dialog({
      title:"Mission → Reset Wizard (v1)",
      content:`
      <form>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="${DEFAULT_PREFIX}"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/></div>
        <div class="form-group"><label>Mission Name</label><input name="missionName" value="${DEFAULT_MISSION_NAME}"/></div>

        <hr>
        <h3>Reset Options</h3>

        <div class="form-group">
          <label><input type="checkbox" name="resetPackets" checked/>
          Reset packets: set all packets to <strong>upcoming</strong> and clear <strong>current</strong></label>
        </div>

        <div class="form-group">
          <label><input type="checkbox" name="resetThreat" checked/>
          Reset threat: set level to 0 and optionally clear log</label>
        </div>

        <div class="form-group" style="margin-left:1.25em;">
          <label><input type="checkbox" name="clearThreatLog" checked/> Clear threat log</label>
        </div>

        <div class="form-group" style="margin-left:1.25em;">
          <label>Threat Max</label>
          <input name="threatMax" type="number" value="${DEFAULT_THREAT_MAX}" min="1"/>
        </div>

        <div class="form-group">
          <label><input type="checkbox" name="syncIcons" checked/>
          Sync packet name icons to packetStatus flags (idempotent)</label>
        </div>

        <hr>
        <h3>After Reset</h3>

        <div class="form-group">
          <label><input type="checkbox" name="openOverview" checked/> Open Mission Overview</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="openDashboard" checked/> Open Packet Dashboard</label>
        </div>

        <p class="notes" style="color:#b00;">
          <strong>Safe reset:</strong> This only touches journals inside <code>${DEFAULT_PREFIX} M${DEFAULT_MISSION}</code> scope.
        </p>
      </form>
      `,
      buttons:{
        run:{ icon:'<i class="fas fa-undo"></i>', label:"Reset", callback:html=>{
          const f = html[0].querySelector("form");
          resolve({
            prefix:f.prefix.value.trim(),
            mission:Number(f.mission.value),
            missionName:f.missionName.value.trim(),
            resetPackets:!!f.resetPackets.checked,
            resetThreat:!!f.resetThreat.checked,
            clearThreatLog:!!f.clearThreatLog.checked,
            threatMax:Math.max(1, Number(f.threatMax.value) || DEFAULT_THREAT_MAX),
            syncIcons:!!f.syncIcons.checked,
            openOverview:!!f.openOverview.checked,
            openDashboard:!!f.openDashboard.checked
          });
        }},
        cancel:{ icon:'<i class="fas fa-times"></i>', label:"Cancel", callback:()=>resolve(null) }
      },
      default:"run"
    }).render(true);
  });
}

async function setVisibleStatusIcon(journal, status) {
  const base = OSR_LIB.stripStatusIconPrefix(journal.name);
  const icon = ICONS[status] ?? ICONS.upcoming;
  const newName = `${icon} ${base}`;
  if (newName !== journal.name) await journal.update({ name: newName });
}

function renderThreatConsoleHtml(tag, state) {
  const pct = state.max > 0 ? Math.round((state.level / state.max) * 100) : 0;
  const log = (state.log ?? []).slice(-12).reverse();
  return `
<h1>${OSR_LIB.esc(tag)} — Threat Console</h1>
<p><em>Updated: ${OSR_LIB.esc(state.updatedAt || OSR_LIB.nowStamp())}</em></p>
<hr>
<h2>Current Threat</h2>
<p style="font-size:1.25em;"><strong>${state.level}</strong> / ${state.max} (${pct}%)</p>
<hr>
<h2>Recent Log</h2>
${log.length ? `<ul>${log.map(x => `<li>${OSR_LIB.esc(x)}</li>`).join("")}</ul>` : `<p><em>No log entries yet.</em></p>`}
`.trim();
}

async function getOrCreateFirstTextPage(journal, pageName="Console"){
  const existing = journal.pages?.contents?.find(p=>p.type==="text");
  if (existing) return existing;
  const [p] = await journal.createEmbeddedDocuments("JournalEntryPage",[{name:pageName,type:"text",text:{content:""}}]);
  return p;
}

// ---------------- MAIN ----------------
const cfg = await promptResetWizard();
if (!cfg) return;

const M = `M${cfg.mission}`;
const tagPrefix = `${cfg.prefix} ${M} `;

// Collect scope journals
const scopedJournals = game.journal.contents.filter(j => {
  const clean = OSR_LIB.stripStatusIconPrefix(j.name);
  return clean.startsWith(tagPrefix);
});

// Packets in scope
const packets = scopedJournals.filter(j => {
  const clean = OSR_LIB.stripStatusIconPrefix(j.name);
  return OSR_LIB.isPacket(clean);
});

// Named key journals
const overviewName  = `${cfg.prefix} ${M} — Mission Overview: ${cfg.missionName}`;
const dashboardName = `${cfg.prefix} ${M} — Packet Dashboard: ${cfg.missionName}`;
const threatName    = `${cfg.prefix} ${M} — Threat Console: ${cfg.missionName}`;

const overview  = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === overviewName);
const dashboard = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === dashboardName);
const threatJ   = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === threatName);

let updates = 0;

// 1) Reset packets
if (cfg.resetPackets) {
  for (const j of packets) {
    const cur = j.getFlag("lancer","currentPacket") === true;
    const status = j.getFlag("lancer","packetStatus") ?? "upcoming";

    if (status !== "upcoming") { await j.setFlag("lancer","packetStatus","upcoming"); updates++; }
    if (cur) { await j.unsetFlag("lancer","currentPacket"); updates++; }
  }
}

// 2) Reset threat
if (cfg.resetThreat) {
  if (!threatJ) {
    ui.notifications.warn(`Threat Console not found: "${threatName}" (skipping threat reset).`);
  } else {
    let state = threatJ.getFlag("lancer","threatState") ?? { level:0, max:cfg.threatMax, log:[] };
    state.max = cfg.threatMax;
    state.level = 0;
    state.updatedAt = OSR_LIB.nowStamp();
    state.log = cfg.clearThreatLog ? [] : (state.log ?? []);
    state.log.push(`[${state.updatedAt}] Reset threat → 0/${state.max}`);

    await threatJ.setFlag("lancer","threatState", state);
    const page = await getOrCreateFirstTextPage(threatJ, "Console");
    await page.update({ "text.content": renderThreatConsoleHtml(`${cfg.prefix} ${M}`, state) });
    updates++;
  }
}

// 3) Sync icons to flags (idempotent)
if (cfg.syncIcons) {
  for (const j of packets) {
    const status = j.getFlag("lancer","packetStatus") ?? "upcoming";
    await setVisibleStatusIcon(j, status);
  }
  updates++;
}

// Done
ui.notifications.info(`Reset complete for ${cfg.prefix} ${M}. Updates applied: ${updates}`);

// 4) Open key journals
if (cfg.openOverview && overview) overview.sheet.render(true);
if (cfg.openDashboard && dashboard) dashboard.sheet.render(true);
