/***** OSR_LIB (shared helpers) *****/
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

/**
 * Extract next packet UUID from a dedicated "Next Packet" section.
 * Required structure:
 * <h2>Next Packet</h2>
 * <p>@UUID[JournalEntry.ID]{...}</p>
 */
function extractNextPacketUuid(html) {
  const s = String(html ?? "");

  // Preferred: UUID following <h2>Next Packet</h2>
  const h2 = s.match(
    /<h2[^>]*>\s*Next\s*Packet\s*<\/h2>[\s\S]{0,1200}?@UUID\[\s*(JournalEntry\.[A-Za-z0-9]+)\s*]\{/i
  );
  if (h2?.[1]) return h2[1];

  // Fallback: textual "Next Packet" label
  const labeled = s.match(
    /Next\s*Packet[\s\S]{0,1200}?@UUID\[\s*(JournalEntry\.[A-Za-z0-9]+)\s*]\{/i
  );
  if (labeled?.[1]) return labeled[1];

  // Final fallback: last UUID in page (avoids Jump row grabbing first link)
  const all = [...s.matchAll(/@UUID\[\s*(JournalEntry\.[A-Za-z0-9]+)\s*]\{/g)].map(m => m[1]);
  return all.length ? all[all.length - 1] : null;
}

try {
  // 1) Locate current packet
  const current = game.journal.contents.find(j => j.getFlag("lancer","currentPacket") === true);
  if (!current) {
    ui.notifications.warn("Advance Next Packet: No Current Packet set.");
    return;
  }

  const clean = OSR_LIB.stripStatusIconPrefix(current.name);
  if (!OSR_LIB.isPacket(clean)) {
    ui.notifications.warn(`Advance Next Packet: Current journal is not a packet: "${current.name}"`);
    return;
  }

  // 2) Extract Next Packet UUID
  let nextUuid = null;
  for (const p of current.pages?.contents ?? []) {
    if (p.type !== "text") continue;
    const found = extractNextPacketUuid(p.text?.content ?? "");
    if (found) { nextUuid = found; break; }
  }

  if (!nextUuid) {
    ui.notifications.warn(`Advance Next Packet: No Next Packet UUID found in "${current.name}".`);
    return;
  }

  // 3) Resolve and validate
  const nextId = nextUuid.split(".")[1];
  const next = game.journal.get(nextId);

  if (!next) {
    ui.notifications.warn(`Advance Next Packet: Journal not found for UUID ${nextUuid}`);
    return;
  }

  const nextClean = OSR_LIB.stripStatusIconPrefix(next.name);
  if (!OSR_LIB.isPacket(nextClean)) {
    ui.notifications.warn(`Advance Next Packet: Next link points to non-packet "${next.name}".`);
    return;
  }

  // 4) Open next packet
  next.sheet.render(true);
  ui.notifications.info(`Advance Next Packet → Opened ${next.name}`);

} catch (err) {
  console.error(err);
  ui.notifications.error(`Advance Next Packet error: ${err?.message ?? err}`);
}
