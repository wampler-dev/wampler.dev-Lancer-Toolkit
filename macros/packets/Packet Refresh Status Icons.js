/**
 * Packet → Refresh Status Icons (v4)
 * Fixes the "prepends extra spaces/invisible chars" issue by normalizing:
 * - Removes existing status icon prefix (⏳▶️✅) + any trailing whitespace/invisible chars
 * - Removes leading whitespace + invisible characters (ZWSP/ZWNJ/ZWJ/BOM/VS16/etc.)
 * - Re-adds exactly one status icon + one normal space
 *
 * Scope:
 * - Only journals matching PREFIX + M# (dialog)
 * - Only journals that look like packets (contain B## or C##)
 */

const DEFAULT_PREFIX = "OSR";
const DEFAULT_MISSION = 1;

// Status icons used in your workflow
const ICONS = {
  upcoming: "⏳",
  active: "▶️",
  completed: "✅"
};

// Invisible / formatting chars commonly responsible for “space creep”
// - \uFE0F (VS16) shows up in emoji sequences
// - \u200B (ZWSP), \u200C (ZWNJ), \u200D (ZWJ)
// - \u2060 (WORD JOINER)
// - \uFEFF (BOM)
const INVIS = "\u200B\u200C\u200D\u2060\uFE0F\uFEFF";

function stripStatusIconPrefixAndJunk(name) {
  let s = String(name);

  // 1) Strip any leading icon (⏳▶️✅) plus any spaces/invisibles following it
  //    The class includes our invisibles explicitly.
  const junkClass = `[\\s${INVIS}]*`;
  s = s.replace(new RegExp(`^[⏳▶️✅]${junkClass}`, "u"), "");

  // 2) Strip ALL leading whitespace/invisible chars (even if no icon present)
  s = s.replace(new RegExp(`^${junkClass}`, "u"), "");

  return s;
}

function isPacket(cleanName) {
  return /\b(B|C)\d+\b/.test(cleanName);
}

async function promptScope() {
  return new Promise(resolve => {
    new Dialog({
      title: "Refresh Status Icons (v4)",
      content: `
        <form>
          <div class="form-group">
            <label>Module Prefix</label>
            <input type="text" name="prefix" value="${DEFAULT_PREFIX}"/>
          </div>
          <div class="form-group">
            <label>Mission #</label>
            <input type="number" name="mission" value="${DEFAULT_MISSION}" min="1" step="1"/>
          </div>
          <p class="notes">This will normalize names and reapply ⏳▶️✅ prefixes safely.</p>
        </form>
      `,
      buttons: {
        ok: {
          icon: '<i class="fas fa-sync"></i>',
          label: "Refresh",
          callback: html => {
            const f = html[0].querySelector("form");
            resolve({ prefix: f.prefix.value.trim(), mission: Number(f.mission.value) });
          }
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok"
    }).render(true);
  });
}

const cfg = await promptScope();
if (!cfg) return;

const TAG = `${cfg.prefix} M${cfg.mission} `;

// Gather in-scope packet journals
const packets = game.journal.contents.filter(j => {
  const base = stripStatusIconPrefixAndJunk(j.name);
  return base.startsWith(TAG) && isPacket(base);
});

if (!packets.length) {
  ui.notifications.warn(`No packet journals found for "${cfg.prefix} M${cfg.mission}".`);
  return;
}

let changed = 0;

for (const j of packets) {
  const base = stripStatusIconPrefixAndJunk(j.name);

  const status = j.getFlag("lancer", "packetStatus") || "upcoming";
  const icon = ICONS[status] ?? ICONS.upcoming;

  // The only allowed prefix format: "<ICON><space><base>"
  const newName = `${icon} ${base}`;

  if (newName !== j.name) {
    await j.update({ name: newName });
    changed++;
  }
}

ui.notifications.info(`Status icons refreshed. Updated ${changed} journal(s).`);
