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
      title:"Open Current Packet (v2)",
      content:`
      <form>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="${DEFAULT_PREFIX}"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/></div>
      </form>`,
      buttons:{
        ok:{icon:'<i class="fas fa-folder-open"></i>',label:"Open",callback:html=>{
          const f=html[0].querySelector("form");
          resolve({prefix:f.prefix.value.trim(), mission:Number(f.mission.value)});
        }},
        cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel",callback:()=>resolve(null)}
      },
      default:"ok"
    }).render(true);
  });
}

const cfg = await promptScope();
if (!cfg) return;

const M=`M${cfg.mission}`;
const tagPrefix=`${cfg.prefix} ${M} `;

const current = game.journal.contents.find(j=>{
  const clean=OSR_LIB.stripStatusIconPrefix(j.name);
  return clean.startsWith(tagPrefix) && OSR_LIB.isPacket(clean) && j.getFlag("lancer","currentPacket")===true;
});

if (!current){ ui.notifications.warn("No Current Packet set."); return; }
current.sheet.render(true);
