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
  function isPacket(cleanName) { return /\b(B|C)\d+\b/.test(cleanName); }
  function nowStamp(){ return new Date().toLocaleString(); }
  return { stripStatusIconPrefix, isPacket, nowStamp };
})();
/***** /OSR_LIB *****/

const DEFAULT_MISSION_NAME = "The Drop";
const DEFAULT_STAMP_PACKET = true;
const ICONS = { upcoming: "⏳", active: "▶️", completed: "✅" };

function detectScope(cleanName) {
  const m = cleanName.match(/^\s*([A-Za-z0-9]+)\s+M(\d+)\b/);
  if (!m) return null;
  return { prefix: m[1], mission: Number(m[2]), tag: `${m[1]} M${Number(m[2])}` };
}

async function getOrCreateFirstTextPage(journal) {
  const existingText = journal.pages?.contents?.find(p => p.type === "text");
  if (existingText) return existingText;
  const [page] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
    name: "Page", type: "text", text: { content: "" }
  }]);
  return page;
}

async function setVisibleStatusIcon(journal, status) {
  const base = OSR_LIB.stripStatusIconPrefix(journal.name);
  const icon = ICONS[status] ?? ICONS.upcoming;
  const newName = `${icon} ${base}`;
  if (newName !== journal.name) await journal.update({ name: newName });
}

/**
 * Extract next UUID from a dedicated "Next Packet" section.
 * Your actual block:
 * <h2>Next Packet</h2>
 * <p><strong>@UUID[JournalEntry.ID]{...}</strong></p>
 */
function extractNextPacketUuid(html) {
  const s = String(html ?? "");

  // Prefer: UUID under an <h2>Next Packet</h2> header
  const h2 = s.match(/<h2[^>]*>\s*Next\s*Packet\s*<\/h2>[\s\S]{0,1200}?@UUID\[\s*(JournalEntry\.[A-Za-z0-9]+)\s*]\{/i);
  if (h2?.[1]) return h2[1];

  // Alternate: plain text "Next Packet" label
  const labeled = s.match(/Next\s*Packet[\s\S]{0,1200}?@UUID\[\s*(JournalEntry\.[A-Za-z0-9]+)\s*]\{/i);
  if (labeled?.[1]) return labeled[1];

  // Last resort: last UUID in page (avoids Jump row grabbing first link)
  const all = [...s.matchAll(/@UUID\[\s*(JournalEntry\.[A-Za-z0-9]+)\s*]\{/g)].map(m => m[1]);
  return all.length ? all[all.length - 1] : null;
}

async function promptAdvanceThreat() {
  return new Promise(resolve => {
    new Dialog({
      title: "Advance Threat +1?",
      content: `
        <form>
          <p><strong>Advance Threat by +1 now?</strong></p>
          <div class="form-group">
            <label>Mission Name (Threat Console lookup)</label>
            <input type="text" name="missionName" value="${DEFAULT_MISSION_NAME}"/>
          </div>
          <div class="form-group">
            <label>Log note (optional)</label>
            <input type="text" name="note" placeholder="Alarm escalates, reinforcements, clock tick..." />
          </div>
          <div class="form-group">
            <label><input type="checkbox" name="stamp" ${DEFAULT_STAMP_PACKET ? "checked" : ""}/> Stamp completed packet</label>
          </div>
        </form>
      `,
      buttons: {
        yes: { icon: '<i class="fas fa-arrow-up"></i>', label: "Yes (+1)", callback: html => {
          const f = html[0].querySelector("form");
          resolve({ doIt: true, missionName: f.missionName.value.trim(), note: f.note.value.trim(), stamp: !!f.stamp.checked });
        }},
        no: { icon: '<i class="fas fa-ban"></i>', label: "No", callback: () => resolve({ doIt: false }) }
      },
      default: "yes"
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

try {
  // 1) Identify current packet (by flag)
  let current = game.journal.contents.find(j => j.getFlag("lancer", "currentPacket") === true);

  if (!current) {
    ui.notifications.warn("Session Loop: No Current Packet set.");
    return;
  }

  const currentClean = OSR_LIB.stripStatusIconPrefix(current.name);
  if (!OSR_LIB.isPacket(currentClean)) {
    ui.notifications.warn(`Session Loop: Current journal is not a packet: "${current.name}"`);
    return;
  }

  const scope = detectScope(currentClean);
  if (!scope) {
    ui.notifications.warn(`Session Loop: Couldn't parse PREFIX/M# from "${current.name}"`);
    return;
  }

  // 2) Extract next packet UUID from pages
  let nextUuid = null;
  for (const p of current.pages?.contents ?? []) {
    if (p.type !== "text") continue;
    const found = extractNextPacketUuid(p.text?.content ?? "");
    if (found) { nextUuid = found; break; }
  }

  if (!nextUuid) {
    ui.notifications.warn(`Session Loop: No Next Packet UUID found in "${current.name}".`);
    return;
  }

  const nextId = nextUuid.split(".")[1];
  const next = game.journal.get(nextId);

  if (!next) {
    ui.notifications.warn(`Session Loop: Next packet journal not found by UUID: ${nextUuid}`);
    return;
  }

  if (!OSR_LIB.isPacket(OSR_LIB.stripStatusIconPrefix(next.name))) {
    ui.notifications.warn(`Session Loop: Next link points to non-packet "${next.name}". Fix Next Packet link.`);
    return;
  }

  // 3) Complete current
  await current.setFlag("lancer", "packetStatus", "completed");
  await current.unsetFlag("lancer", "currentPacket");
  await setVisibleStatusIcon(current, "completed");

  // 4) Optional Threat
  const adv = await promptAdvanceThreat();
  if (adv?.doIt) {
    const consoleName = `${scope.prefix} M${scope.mission} — Threat Console: ${adv.missionName}`;
    const consoleJournal = game.journal.contents.find(j => OSR_LIB.stripStatusIconPrefix(j.name) === consoleName);

    if (!consoleJournal) {
      ui.notifications.warn(`Session Loop: Threat Console not found: "${consoleName}" (skipping threat).`);
    } else {
      const state = consoleJournal.getFlag("lancer","threatState") ?? { level: 0, max: 6, log: [] };
      state.max = Math.max(1, state.max ?? 6);

      const before = state.level ?? 0;
      state.level = Math.min(before + 1, state.max);
      state.updatedAt = OSR_LIB.nowStamp();
      state.log = state.log ?? [];

      const notePart = adv.note ? ` — ${adv.note}` : "";
      state.log.push(`[${state.updatedAt}] Threat +1 → ${state.level}${notePart}`);
      await consoleJournal.setFlag("lancer","threatState", state);

      if (adv.stamp) {
        const page = await getOrCreateFirstTextPage(current);
        const cur = page.text?.content ?? "";
        const stampLine = `<li>[${state.updatedAt}] <strong>Threat +1</strong> → ${state.level}${adv.note ? ` — ${adv.note}` : ""}</li>`;
        if (!cur.includes('data-lancer-threat-notes="1"')) {
          const block = `
<hr>
<h2 data-lancer-threat-notes="1">Threat Notes</h2>
<ul data-lancer-threat-list="1">
  ${stampLine}
</ul>
`.trim();
          await page.update({ "text.content": `${cur}\n${block}`.trim() });
        } else {
          const updated = cur.replace(
            /(<ul[^>]*data-lancer-threat-list="1"[^>]*>)([\s\S]*?)(<\/ul>)/i,
            (m, open, inner, close) => `${open}${inner}\n  ${stampLine}\n${close}`
          );
          await page.update({ "text.content": updated });
        }
      }

      const consolePage = await getOrCreateFirstTextPage(consoleJournal);
      await consolePage.update({ "text.content": renderConsoleHtml(`${scope.prefix} M${scope.mission}`, state) });
    }
  }

  // 5) Activate next (clear stray currents, set next active/current)
  for (const j of game.journal.contents) {
    if (j.getFlag("lancer","currentPacket") === true) await j.unsetFlag("lancer","currentPacket");
  }

  await next.setFlag("lancer","packetStatus","active");
  await next.setFlag("lancer","currentPacket", true);
  await setVisibleStatusIcon(next,"active");

  next.sheet.render(true);
  ui.notifications.info(`Session Loop: advanced to ${next.name}`);
} catch (err) {
  console.error(err);
  ui.notifications.error(`Session Loop error: ${err?.message ?? err}`);
}
