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

const DEFAULT_PREFIX="OSR", DEFAULT_MISSION=1;

async function promptScope(){
  return new Promise(resolve=>{
    new Dialog({
      title:"Packet → RESET ALL (v3)",
      content:`<form>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="${DEFAULT_PREFIX}"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/></div>
        <p class="notes" style="color:#b00;"><strong>This sets ALL packets to Upcoming and clears Current.</strong></p>
      </form>`,
      buttons:{
        ok:{icon:'<i class="fas fa-bomb"></i>',label:"RESET",callback:html=>{
          const f=html[0].querySelector("form");
          resolve({prefix:f.prefix.value.trim(), mission:Number(f.mission.value)});
        }},
        cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel",callback:()=>resolve(null)}
      },
      default:"cancel"
    }).render(true);
  });
}

const cfg = await promptScope();
if (!cfg) return;

const M=`M${cfg.mission}`;
const tagPrefix=`${cfg.prefix} ${M} `;

let changed=0;
for (const j of game.journal.contents) {
  const clean=OSR_LIB.stripStatusIconPrefix(j.name);
  if (!clean.startsWith(tagPrefix) || !OSR_LIB.isPacket(clean)) continue;

  if (j.getFlag("lancer","packetStatus") !== "upcoming") { await j.setFlag("lancer","packetStatus","upcoming"); changed++; }
  if (j.getFlag("lancer","currentPacket") === true) { await j.unsetFlag("lancer","currentPacket"); changed++; }
}

ui.notifications.info(`Reset complete. Updates applied: ${changed}`);
