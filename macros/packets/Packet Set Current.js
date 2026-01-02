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
      title:"Set Current Packet (v2)",
      content:`
      <form>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="${DEFAULT_PREFIX}"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="${DEFAULT_MISSION}" min="1"/></div>
      </form>`,
      buttons:{
        ok:{icon:'<i class="fas fa-bullseye"></i>',label:"Set",callback:html=>{
          const f=html[0].querySelector("form");
          resolve({prefix:f.prefix.value.trim(), mission:Number(f.mission.value)});
        }},
        cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel",callback:()=>resolve(null)}
      },
      default:"ok"
    }).render(true);
  });
}

async function pickPacketDialog(tagPrefix){
  const packets = game.journal.contents
    .filter(j=>{
      const clean=OSR_LIB.stripStatusIconPrefix(j.name);
      return clean.startsWith(tagPrefix) && OSR_LIB.isPacket(clean);
    })
    .sort((a,b)=>OSR_LIB.stripStatusIconPrefix(a.name).localeCompare(OSR_LIB.stripStatusIconPrefix(b.name)));

  if (!packets.length) return null;

  const options = packets.map(j=>`<option value="${j.id}">${j.name}</option>`).join("");
  return new Promise(resolve=>{
    new Dialog({
      title:"Select Packet",
      content:`<form><div class="form-group"><label>Packet</label><select name="jid">${options}</select></div></form>`,
      buttons:{
        ok:{icon:'<i class="fas fa-check"></i>',label:"Select",callback:html=>{
          const id=html[0].querySelector('select[name="jid"]').value;
          resolve(game.journal.get(id) ?? null);
        }},
        cancel:{icon:'<i class="fas fa-times"></i>',label:"Cancel",callback:()=>resolve(null)}
      },
      default:"ok"
    }).render(true);
  });
}

function topmostOpenPacket(tagPrefix){
  const wins = Object.values(ui.windows ?? {});
  const docs = wins
    .filter(w=>w?.document?.documentName==="JournalEntry")
    .map(w=>w.document)
    .filter(d=>{
      const clean=OSR_LIB.stripStatusIconPrefix(d.name);
      return clean.startsWith(tagPrefix) && OSR_LIB.isPacket(clean);
    });
  return docs.length ? docs[docs.length-1] : null;
}

const cfg = await promptScope();
if (!cfg) return;

const M=`M${cfg.mission}`;
const tagPrefix=`${cfg.prefix} ${M} `;

let target = topmostOpenPacket(tagPrefix);
if (!target) {
  target = await pickPacketDialog(tagPrefix);
  if (!target) { ui.notifications.warn("No packet selected."); return; }
}

// Clear other currentPacket in scope
for (const j of game.journal.contents) {
  const clean=OSR_LIB.stripStatusIconPrefix(j.name);
  if (!clean.startsWith(tagPrefix) || !OSR_LIB.isPacket(clean)) continue;
  if (j.getFlag("lancer","currentPacket")===true && j.id!==target.id) await j.unsetFlag("lancer","currentPacket");
}

await target.setFlag("lancer","currentPacket", true);
ui.notifications.info(`Current Packet set: ${target.name}`);
