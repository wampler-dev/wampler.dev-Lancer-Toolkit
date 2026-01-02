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
  function nowStamp(){ return new Date().toLocaleString(); }
  return { stripStatusIconPrefix, nowStamp };
})();
/***** /OSR_LIB *****/

const DEFAULT_PREFIX="OSR", DEFAULT_MISSION=1, DEFAULT_MISSION_NAME="The Drop";

async function promptThreatAdvance(){
  return new Promise(resolve=>{
    new Dialog({
      title:"Threat — Advance (+) (v2)",
      content:`
      <form>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="${DEFAULT_PREFIX}"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/></div>
        <div class="form-group"><label>Mission Name</label><input name="missionName" value="${DEFAULT_MISSION_NAME}"/></div>
        <div class="form-group"><label>Log note (optional)</label><input name="note" placeholder="Reinforcements, alarm, deadline..."/></div>
      </form>`,
      buttons:{
        ok:{icon:'<i class="fas fa-arrow-up"></i>',label:"+1",callback:html=>{
          const f=html[0].querySelector("form");
          resolve({prefix:f.prefix.value.trim(), mission:Number(f.mission.value), missionName:f.missionName.value.trim(), note:f.note.value.trim()});
        }},
        cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel",callback:()=>resolve(null)}
      },
      default:"ok"
    }).render(true);
  });
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

async function getOrCreateFirstTextPage(journal){
  const existing = journal.pages?.contents?.find(p=>p.type==="text");
  if (existing) return existing;
  const [p] = await journal.createEmbeddedDocuments("JournalEntryPage",[{name:"Console",type:"text",text:{content:""}}]);
  return p;
}

const cfg = await promptThreatAdvance();
if (!cfg) return;

const M = `M${cfg.mission}`;
const consoleName = `${cfg.prefix} ${M} — Threat Console: ${cfg.missionName}`;
const consoleJournal = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === consoleName);

if (!consoleJournal){
  ui.notifications.error(`Threat Console not found: "${consoleName}"`);
  return;
}

const state = consoleJournal.getFlag("lancer","threatState") ?? { level:0, max:6, log:[] };
state.max = Math.max(1, state.max ?? 6);
state.level = Math.min((state.level ?? 0) + 1, state.max);
state.updatedAt = OSR_LIB.nowStamp();
state.log = state.log ?? [];

const notePart = cfg.note ? ` — ${cfg.note}` : "";
state.log.push(`[${state.updatedAt}] Threat +1 → ${state.level}${notePart}`);

await consoleJournal.setFlag("lancer","threatState", state);

const page = await getOrCreateFirstTextPage(consoleJournal);
await page.update({ "text.content": renderConsoleHtml(`${cfg.prefix} ${M}`, state) });

consoleJournal.sheet.render(true);
ui.notifications.info(`Threat is now ${state.level}/${state.max}.`);
