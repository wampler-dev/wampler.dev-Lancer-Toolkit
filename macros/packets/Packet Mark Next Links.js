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
  return { stripStatusIconPrefix, isPacket };
})();
/***** /OSR_LIB *****/

const DEFAULT_PREFIX = "OSR";
const DEFAULT_MISSION = 1;

async function promptScope(){
  return new Promise(resolve=>{
    new Dialog({
      title: "Packet → Mark Next Links (v1)",
      content: `
      <form>
        <div class="form-group">
          <label>Prefix</label>
          <input name="prefix" value="${DEFAULT_PREFIX}"/>
        </div>
        <div class="form-group">
          <label>Mission #</label>
          <input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/>
        </div>
        <p class="notes">
          This will mark <strong>Next Packet</strong> links with
          <code>data-lancer-next="1"</code>.
          Safe to run multiple times.
        </p>
      </form>`,
      buttons:{
        ok:{ icon:'<i class="fas fa-check"></i>', label:"Run", callback:html=>{
          const f = html[0].querySelector("form");
          resolve({ prefix:f.prefix.value.trim(), mission:Number(f.mission.value) });
        }},
        cancel:{ icon:'<i class="fas fa-times"></i>', label:"Cancel", callback:()=>resolve(null) }
      },
      default:"ok"
    }).render(true);
  });
}

function markNextInHtml(html){
  let changed = false;
  let out = String(html ?? "");

  // Locate <h2>Next Packet</h2> section
  const re = /(<h2[^>]*>\s*Next\s*Packet\s*<\/h2>)([\s\S]{0,1200}?)(@UUID\[\s*JournalEntry\.[A-Za-z0-9]+\s*]\{[^}]+})/i;

  out = out.replace(re, (match, h2, between, uuid) => {
    // If already marked, do nothing
    if (/data-lancer-next\s*=\s*["']1["']/i.test(match)) return match;

    changed = true;
    return `${h2}${between}<p data-lancer-next="1"><strong>${uuid}</strong></p>`;
  });

  return { html: out, changed };
}

// ---------------- MAIN ----------------
const cfg = await promptScope();
if (!cfg) return;

const M = `M${cfg.mission}`;
const tagPrefix = `${cfg.prefix} ${M} `;

const packets = game.journal.contents.filter(j=>{
  const clean = OSR_LIB.stripStatusIconPrefix(j.name);
  return clean.startsWith(tagPrefix) && OSR_LIB.isPacket(clean);
});

if (!packets.length) {
  ui.notifications.warn(`No packets found for "${cfg.prefix} ${M}".`);
  return;
}

let touched = 0;
let modified = 0;

for (const j of packets) {
  for (const p of j.pages?.contents ?? []) {
    if (p.type !== "text") continue;

    const { html, changed } = markNextInHtml(p.text?.content ?? "");
    if (changed) {
      await p.update({ "text.content": html });
      touched++;
      modified++;
      break;
    }
    touched++;
  }
}

ui.notifications.info(
  `Next Packet marking complete. ` +
  `Packets scanned: ${packets.length}. ` +
  `Pages modified: ${modified}.`
);
