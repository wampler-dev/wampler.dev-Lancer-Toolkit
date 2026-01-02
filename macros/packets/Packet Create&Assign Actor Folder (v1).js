// Packet → Create / Assign Actor Folder (v1)
// Creates/reuses an Actor folder for the detected packet and binds it via flags.lancer.packetActorFolderId

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

const FLAG_SCOPE = "lancer";
const FLAG_FOLDER = "packetActorFolderId";

/* Detect packet (currentPacket preferred, fallback to topmost open) */
function detectPacketJournal() {
  const cur = game.journal.contents.find(j => j.getFlag("lancer","currentPacket") === true);
  if (cur) return cur;

  const wins = Object.values(ui.windows ?? {});
  const journalWins = wins.filter(w => w?.object?.documentName === "JournalEntry");
  if (!journalWins.length) return null;

  journalWins.sort((a,b)=> (a.position?.z ?? 0) - (b.position?.z ?? 0));
  return journalWins[journalWins.length-1].object ?? null;
}

/* Find mission root folder */
function findMissionRoot(prefix, mission, missionName) {
  const rootName = `${prefix} M${mission} — ${missionName}`;
  return game.folders.contents.find(f =>
    f.type === "Actor" && f.name === rootName && !f.folder
  ) ?? null;
}

/* Get or create Actors root */
async function getOrCreateActorsRoot(missionRoot) {
  const existing = game.folders.contents.find(f =>
    f.type === "Actor" &&
    f.name === "Actors" &&
    f.folder?.id === missionRoot.id
  );
  if (existing) return existing;

  return await Folder.create({
    name: "Actors",
    type: "Actor",
    folder: missionRoot.id,
    sorting: "a"
  });
}

// ---------------- MAIN ----------------
const packet = detectPacketJournal();
if (!packet) {
  ui.notifications.warn("Actor Folder: No packet detected.");
  return;
}

const cleanName = OSR_LIB.stripStatusIconPrefix(packet.name);
if (!OSR_LIB.isPacket(cleanName)) {
  ui.notifications.warn(`Actor Folder: Not a packet: "${packet.name}"`);
  return;
}

/* Parse prefix + mission from name */
const m = cleanName.match(/^([A-Za-z0-9]+)\s+M(\d+)\b/);
if (!m) {
  ui.notifications.warn("Actor Folder: Could not infer mission from packet name.");
  return;
}
const prefix = m[1];
const mission = Number(m[2]);

/* Mission name guess (strip prefix+code) */
const missionNameGuess =
  game.folders.contents.find(f =>
    f.type === "Actor" &&
    f.name.startsWith(`${prefix} M${mission} —`)
  )?.name.replace(`${prefix} M${mission} — `,"") ?? "Mission";

/* Locate mission root */
const missionRoot = findMissionRoot(prefix, mission, missionNameGuess);
if (!missionRoot) {
  ui.notifications.warn("Actor Folder: Mission Actor root not found. Create it first.");
  return;
}

/* Get Actors root */
const actorsRoot = await getOrCreateActorsRoot(missionRoot);

/* Packet-specific folder name */
const packetFolderName = cleanName.replace(/^.*?\b(B|C)\d+\b\s*—\s*/,"$1$&")
  .replace(/^.*?\b(B|C)\d+\b\s*—\s*/,"")
  .trim() || cleanName;

/* Reuse existing packet folder */
let packetFolder = game.folders.contents.find(f =>
  f.type === "Actor" &&
  f.name === packetFolderName &&
  f.folder?.id === actorsRoot.id
);

if (!packetFolder) {
  packetFolder = await Folder.create({
    name: packetFolderName,
    type: "Actor",
    folder: actorsRoot.id,
    sorting: "a"
  });
}

/* Bind folder to packet */
await packet.setFlag(FLAG_SCOPE, FLAG_FOLDER, packetFolder.id);

ui.notifications.info(`Actor folder ready: ${packetFolder.name}`);
