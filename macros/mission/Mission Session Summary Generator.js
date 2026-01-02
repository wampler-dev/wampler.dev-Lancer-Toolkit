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
  function now(){ return new Date().toLocaleString(); }
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;");
  }
  return { stripStatusIconPrefix, isPacket, now, esc };
})();
/***** /OSR_LIB *****/

const DEFAULT_PREFIX = "OSR";
const DEFAULT_MISSION = 1;
const DEFAULT_MISSION_NAME = "The Drop";

async function promptScope(){
  return new Promise(resolve=>{
    new Dialog({
      title: "Mission → Generate Session Summary (v1.1)",
      content: `
      <form>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="${DEFAULT_PREFIX}"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/></div>
        <div class="form-group"><label>Mission Name</label><input name="missionName" value="${DEFAULT_MISSION_NAME}"/></div>
      </form>`,
      buttons:{
        ok:{ label:"Generate", callback:html=>{
          const f = html[0].querySelector("form");
          resolve({
            prefix:f.prefix.value.trim(),
            mission:Number(f.mission.value),
            missionName:f.missionName.value.trim()
          });
        }},
        cancel:{ label:"Cancel", callback:()=>resolve(null) }
      },
      default:"ok"
    }).render(true);
  });
}

async function getOrCreateFirstTextPage(journal){
  const p = journal.pages?.contents?.find(x=>x.type==="text");
  if (p) return p;
  const [page] = await journal.createEmbeddedDocuments("JournalEntryPage",[{
    name:"Summary", type:"text", text:{ content:"" }
  }]);
  return page;
}

// ---------------- MAIN ----------------
const cfg = await promptScope();
if (!cfg) return;

const M = `M${cfg.mission}`;
const tagPrefix = `${cfg.prefix} ${M} `;

// Gather packets
const packets = game.journal.contents
  .filter(j=>{
    const clean = OSR_LIB.stripStatusIconPrefix(j.name);
    return clean.startsWith(tagPrefix) && OSR_LIB.isPacket(clean);
  })
  .map(j=>{
    const clean = OSR_LIB.stripStatusIconPrefix(j.name);
    return {
      short: clean.replace(tagPrefix,""),
      status: j.getFlag("lancer","packetStatus") ?? "upcoming",
      current: j.getFlag("lancer","currentPacket") === true
    };
  })
  .sort((a,b)=>a.short.localeCompare(b.short));

const completed = packets.filter(p=>p.status==="completed");
const current = packets.find(p=>p.current);

// Threat
const threatName = `${cfg.prefix} ${M} — Threat Console: ${cfg.missionName}`;
const threatJournal = game.journal.contents.find(j =>
  OSR_LIB.stripStatusIconPrefix(j.name) === threatName
);

let threatLine = "Not found";
let threatLog = [];

if (threatJournal) {
  const state = threatJournal.getFlag("lancer","threatState");
  if (state) {
    threatLine = `${state.level} / ${state.max}`;
    threatLog = state.log ?? [];
  }
}

// Build HTML block
const html = `
<section class="lancer-session-summary">
  <hr>
  <h2>Session Summary — ${OSR_LIB.now()}</h2>

  <h3>Packets Completed</h3>
  ${completed.length
    ? `<ul>${completed.map(p=>`<li>${OSR_LIB.esc(p.short)}</li>`).join("")}</ul>`
    : `<p><em>None</em></p>`}

  <h3>Current Packet</h3>
  <p>${current ? OSR_LIB.esc(current.short) : "<em>None</em>"}</p>

  <h3>Final Threat</h3>
  <p>${OSR_LIB.esc(threatLine)}</p>

  <h3>Threat Log</h3>
  ${threatLog.length
    ? `<ul>${threatLog.map(e=>`<li>${OSR_LIB.esc(e)}</li>`).join("")}</ul>`
    : `<p><em>No threat log entries</em></p>`}
</section>
`.trim();

// Write
const debriefName = `${cfg.prefix} ${M} — Mission Debrief: ${cfg.missionName}`;
const debrief = game.journal.contents.find(j =>
  OSR_LIB.stripStatusIconPrefix(j.name) === debriefName
);

if (!debrief) {
  ui.notifications.warn(`Mission Debrief not found: "${debriefName}"`);
  return;
}

const page = await getOrCreateFirstTextPage(debrief);
const existing = page.text?.content ?? "";
await page.update({ "text.content": `${existing}\n${html}`.trim() });

debrief.sheet.render(true);
ui.notifications.info("Session Summary appended (HTML formatted).");
