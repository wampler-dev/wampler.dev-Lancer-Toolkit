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

// You can edit these defaults to match your exact macro names
const MACROS = {
  dashboard:   "Packet Dashboard — Build/Refresh (v8.2)",
  openCurrent: "Open Current Packet (v2)",
  sessionLoop: "Session Loop — One Button (v4.1)",
  playerView:  "Packet → Open Player View (v2)",
  threatPlus:  "Threat — Advance (+) (v2)",
  threatPanel: "Threat — Control Panel (v2)",
  audit:       "Packet — Audit & Repair (v2.1 + report)"
};

function detectFromCurrentPacket() {
  const cur = game.journal.contents.find(j => j.getFlag("lancer","currentPacket") === true);
  if (!cur) return null;
  const clean = OSR_LIB.stripStatusIconPrefix(cur.name);
  const m = clean.match(/^([A-Za-z0-9]+)\s+M(\d+)\b/);
  if (!m) return null;
  return { prefix: m[1], mission: Number(m[2]), source: `Current Packet: ${clean}` };
}

function getTopmostOpenJournalName() {
  // Foundry v12: grab active window that looks like a Journal sheet
  const wins = Object.values(ui.windows ?? {});
  const journalWins = wins.filter(w => w?.object?.documentName === "JournalEntry" || w?.object instanceof JournalEntry);
  if (!journalWins.length) return null;

  // Sort by z-index if present; fall back to insertion order
  journalWins.sort((a,b) => (a.position?.z ?? 0) - (b.position?.z ?? 0));
  const top = journalWins[journalWins.length - 1];
  const je = top?.object;
  const name = je?.name ?? null;
  return name ? OSR_LIB.stripStatusIconPrefix(name) : null;
}

function detectFromOpenJournal() {
  const name = getTopmostOpenJournalName();
  if (!name) return null;
  const m = name.match(/^([A-Za-z0-9]+)\s+M(\d+)\b/);
  if (!m) return null;
  return { prefix: m[1], mission: Number(m[2]), source: `Open Journal: ${name}` };
}

async function promptScopeFallback() {
  return new Promise(resolve => {
    new Dialog({
      title: "QoL #7 — GM Turn Checklist (Scope)",
      content: `
      <form>
        <p><strong>Auto-detect failed.</strong> Enter mission scope:</p>
        <div class="form-group"><label>Prefix</label><input name="prefix" value="OSR"/></div>
        <div class="form-group"><label>Mission #</label><input name="mission" type="number" value="1" min="1"/></div>
      </form>`,
      buttons: {
        ok: { label:"Continue", callback: html => {
          const f = html[0].querySelector("form");
          resolve({ prefix: f.prefix.value.trim(), mission: Number(f.mission.value), source: "Manual" });
        }},
        cancel: { label:"Cancel", callback: () => resolve(null) }
      },
      default: "ok"
    }).render(true);
  });
}

function findMacroByName(name) {
  if (!name) return null;
  return game.macros.contents.find(m => m.name === name) ?? null;
}

async function runMacro(name) {
  const m = findMacroByName(name);
  if (!m) {
    ui.notifications.warn(`Macro not found: "${name}"`);
    return false;
  }
  await m.execute();
  return true;
}

function toTag(scope){ return `${scope.prefix} M${scope.mission}`; }

async function showChecklist(scope) {
  return new Promise(resolve => {
    const tag = toTag(scope);

    new Dialog({
      title: `GM Turn Checklist — ${tag}`,
      content: `
      <form>
        <p class="notes"><em>Scope:</em> ${tag} <br><em>Detected via:</em> ${scope.source}</p>

        <hr>
        <h3>Primary</h3>
        <div class="form-group">
          <button type="button" data-act="openDashboard"><i class="fas fa-th"></i> Open/Refresh Dashboard</button>
          <button type="button" data-act="openCurrent"><i class="fas fa-book-open"></i> Open Current Packet</button>
        </div>
        <div class="form-group">
          <button type="button" data-act="sessionLoop"><i class="fas fa-forward"></i> Session Loop (advance packet)</button>
          <button type="button" data-act="playerView"><i class="fas fa-users"></i> Update Player View</button>
        </div>

        <hr>
        <h3>Threat</h3>
        <div class="form-group">
          <button type="button" data-act="threatPlus"><i class="fas fa-arrow-up"></i> Threat +1</button>
          <button type="button" data-act="threatPanel"><i class="fas fa-sliders-h"></i> Threat Panel</button>
        </div>

        <hr>
        <h3>Safety</h3>
        <div class="form-group">
          <button type="button" data-act="audit"><i class="fas fa-clipboard-check"></i> Packet Audit</button>
        </div>

        <hr>
        <h3>Auto-follow (optional)</h3>
        <div class="form-group">
          <label><input type="checkbox" name="refreshAfterLoop" checked/> After Session Loop → Refresh Dashboard</label>
        </div>
        <div class="form-group">
          <label><input type="checkbox" name="refreshAfterThreat" /> After Threat +1 → Refresh Dashboard</label>
        </div>
      </form>
      `,
      buttons: {
        close: { icon:'<i class="fas fa-times"></i>', label:"Close", callback: () => resolve(null) }
      },
      render: html => {
        const root = html[0];
        const form = root.querySelector("form");

        async function maybeRefresh(which) {
          const refreshAfterLoop = !!form.refreshAfterLoop.checked;
          const refreshAfterThreat = !!form.refreshAfterThreat.checked;
          if (which === "loop" && refreshAfterLoop) await runMacro(MACROS.dashboard);
          if (which === "threat" && refreshAfterThreat) await runMacro(MACROS.dashboard);
        }

        root.querySelectorAll("button[data-act]").forEach(btn => {
          btn.addEventListener("click", async ev => {
            ev.preventDefault();
            const act = btn.dataset.act;

            if (act === "openDashboard") {
              await runMacro(MACROS.dashboard);
            } else if (act === "openCurrent") {
              await runMacro(MACROS.openCurrent);
            } else if (act === "sessionLoop") {
              const ok = await runMacro(MACROS.sessionLoop);
              if (ok) await maybeRefresh("loop");
            } else if (act === "playerView") {
              await runMacro(MACROS.playerView);
            } else if (act === "threatPlus") {
              const ok = await runMacro(MACROS.threatPlus);
              if (ok) await maybeRefresh("threat");
            } else if (act === "threatPanel") {
              await runMacro(MACROS.threatPanel);
            } else if (act === "audit") {
              await runMacro(MACROS.audit);
            }
          });
        });
      }
    }).render(true);
  });
}

// ---------------- MAIN ----------------
let scope = detectFromCurrentPacket() ?? detectFromOpenJournal();
if (!scope) scope = await promptScopeFallback();
if (!scope) return;

await showChecklist(scope);
