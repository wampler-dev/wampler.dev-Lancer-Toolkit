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
  function esc(s){
    return String(s ?? "")
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  }
  return { stripStatusIconPrefix, isPacket, esc };
})();
/***** /OSR_LIB *****/

const FLAG_SCOPE = "lancer";
const FLAG_SCENE_ID = "packetSceneId";

function detectPacketJournal() {
  const cur = game.journal.contents.find(j => j.getFlag("lancer","currentPacket") === true);
  if (cur) return cur;

  const wins = Object.values(ui.windows ?? {});
  const journalWins = wins.filter(w => w?.object?.documentName === "JournalEntry" || w?.object instanceof JournalEntry);
  if (!journalWins.length) return null;

  journalWins.sort((a,b) => (a.position?.z ?? 0) - (b.position?.z ?? 0));
  const top = journalWins[journalWins.length - 1];
  return top?.object ?? null;
}

function getTopmostJournalSheetFor(entry) {
  const wins = Object.values(ui.windows ?? {});
  const sheets = wins.filter(w =>
    w?.object?.documentName === "JournalEntry" &&
    w?.object?.id === entry.id
  );
  if (!sheets.length) return null;
  sheets.sort((a,b) => (a.position?.z ?? 0) - (b.position?.z ?? 0));
  return sheets[sheets.length - 1];
}

function inferViewedPageId(sheet) {
  try {
    const el = sheet?.element?.[0];
    if (!el) return null;

    const activeTab = el.querySelector("[data-page-id].active, [data-page-id][aria-selected='true']");
    if (activeTab?.dataset?.pageId) return activeTab.dataset.pageId;

    const activePage = el.querySelector(".journal-entry-page.active[data-page-id], .journal-page-content.active[data-page-id]");
    if (activePage?.dataset?.pageId) return activePage.dataset.pageId;

    const any = el.querySelector("[data-page-id]");
    return any?.dataset?.pageId ?? null;
  } catch {
    return null;
  }
}

async function getOrCreateFirstTextPage(journal, pageName="Packet") {
  const existing = journal.pages?.contents?.find(p => p.type === "text");
  if (existing) return existing;
  const [p] = await journal.createEmbeddedDocuments("JournalEntryPage", [{
    name: pageName, type: "text", text: { content: "" }
  }]);
  return p;
}

function upsertSceneBlock(html, scene) {
  const block = `
<section data-osr-scene-block="1">
  <hr>
  <h2>Scene</h2>
  <p>@UUID[Scene.${scene.id}]{${OSR_LIB.esc(scene.name)}}</p>
</section>
`.trim();

  let out = String(html ?? "").trim();
  const re = /<section[^>]*data-osr-scene-block\s*=\s*["']1["'][^>]*>[\s\S]*?<\/section>/i;

  if (re.test(out)) return out.replace(re, block);
  return out ? `${out}\n\n${block}` : block;
}

function makeSceneNameFromPacket(packetName) {
  // Keep the user's naming scheme intact (minus status icon)
  return OSR_LIB.stripStatusIconPrefix(packetName);
}

function sceneOptionsHtml(scenes) {
  const none = `<option value="">(None)</option>`;
  const opts = scenes.map(s => `<option value="${s.id}">${OSR_LIB.esc(s.name)}</option>`).join("");
  return none + opts;
}

async function promptCreate(packet, scenes, existingBoundScene) {
  const suggestedName = makeSceneNameFromPacket(packet.name);

  return new Promise(resolve => {
    new Dialog({
      title: "Packet → Create Scene from Template (v1)",
      content: `
      <form>
        <p><strong>Packet:</strong> ${OSR_LIB.esc(packet.name)}</p>
        <p class="notes"><em>Suggested Scene name:</em> ${OSR_LIB.esc(suggestedName)}</p>
        ${existingBoundScene ? `<p class="notes" style="color:#b00;"><strong>Bound scene already exists:</strong> ${OSR_LIB.esc(existingBoundScene.name)}</p>` : ""}

        <div class="form-group">
          <label>Template Scene</label>
          <select name="templateId">${sceneOptionsHtml(scenes)}</select>
        </div>

        <div class="form-group">
          <label><input type="checkbox" name="cloneConfig" checked/>
          Clone template configuration (grid, dimensions, lighting/vision defaults, etc.)</label>
        </div>

        <div class="form-group" style="margin-left:1.25em;">
          <label><input type="checkbox" name="cloneBackground"/>
          Clone template background image/video</label>
        </div>

        <div class="form-group">
          <label><input type="checkbox" name="bindToPacket" checked/>
          Bind new Scene to packet (flags.lancer.packetSceneId)</label>
        </div>

        <div class="form-group">
          <label><input type="checkbox" name="writeBlock" checked/>
          Write/Update Scene link block in viewed packet page</label>
        </div>

        <hr>
        <div class="form-group">
          <label><input type="checkbox" name="openScene" checked/> Open Scene after creation</label>
        </div>

        <div class="form-group">
          <label><input type="checkbox" name="activateScene"/> Activate Scene (view)</label>
        </div>

        ${existingBoundScene ? `
        <hr>
        <div class="form-group">
          <label><input type="checkbox" name="forceCreate"/>
          Create anyway (even though a scene is already bound)</label>
        </div>` : ""}

      </form>
      `,
      buttons: {
        ok: {
          icon: '<i class="fas fa-plus"></i>',
          label: "Create Scene",
          callback: html => {
            const f = html[0].querySelector("form");
            resolve({
              templateId: f.templateId.value || "",
              cloneConfig: !!f.cloneConfig.checked,
              cloneBackground: !!f.cloneBackground.checked,
              bindToPacket: !!f.bindToPacket.checked,
              writeBlock: !!f.writeBlock.checked,
              openScene: !!f.openScene.checked,
              activateScene: !!f.activateScene.checked,
              forceCreate: !!(f.forceCreate?.checked)
            });
          }
        },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok"
    }).render(true);
  });
}

function buildSceneCreateData(name, template, cfg) {
  // Minimal default scene if no template
  const base = {
    name,
    navName: name,
    navigation: true
  };

  if (!template || !cfg.cloneConfig) return base;

  // Clone a safe subset of template data (avoids copying tokens/drawings/walls/etc.)
  // Foundry v12: template.toObject() is available
  const t = template.toObject();

  // Explicitly omit embedded collections to keep template "clean"
  delete t.tokens;
  delete t.walls;
  delete t.tiles;
  delete t.drawings;
  delete t.lights;
  delete t.sounds;
  delete t.notes;
  delete t.templates;
  delete t.regions;

  // Ensure name + nav
  t.name = name;
  t.navName = name;
  t.navigation = true;

  // Background cloning is optional
  if (!cfg.cloneBackground) {
    // Foundry scene background fields can vary; cover common
    if (t.background) {
      if (t.background.src) t.background.src = null;
    }
    if (typeof t.img !== "undefined") t.img = null;
    if (typeof t.backgroundColor !== "undefined") {
      // leave background color alone (harmless)
    }
  }

  return t;
}

// ---------------- MAIN ----------------
try {
  const packet = detectPacketJournal();
  if (!packet) {
    ui.notifications.warn("Create Scene: No packet detected. Open a packet journal or set a Current Packet.");
    return;
  }

  const clean = OSR_LIB.stripStatusIconPrefix(packet.name);
  if (!OSR_LIB.isPacket(clean)) {
    ui.notifications.warn(`Create Scene: Detected journal is not a packet: "${packet.name}"`);
    return;
  }

  const boundSceneId = packet.getFlag(FLAG_SCOPE, FLAG_SCENE_ID);
  const boundScene = boundSceneId ? game.scenes.get(boundSceneId) : null;

  const scenes = game.scenes.contents.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const cfg = await promptCreate(packet, scenes, boundScene);
  if (!cfg) return;

  if (boundScene && !cfg.forceCreate) {
    ui.notifications.warn("Create Scene: A scene is already bound. Check 'Create anyway' if you want a new one.");
    return;
  }

  const template = cfg.templateId ? game.scenes.get(cfg.templateId) : null;
  const newName = makeSceneNameFromPacket(packet.name);

  // If a scene with the same name already exists, do not duplicate; reuse it
  let scene = game.scenes.contents.find(s => s.name === newName) ?? null;

  if (!scene) {
    const createData = buildSceneCreateData(newName, template, cfg);
    scene = await Scene.create(createData);
  }

  // Bind to packet
  if (cfg.bindToPacket) {
    await packet.setFlag(FLAG_SCOPE, FLAG_SCENE_ID, scene.id);
  }

  // Write link block
  let wroteTo = "(no page write)";
  if (cfg.writeBlock) {
    const sheet = getTopmostJournalSheetFor(packet);
    const viewedPageId = inferViewedPageId(sheet);

    let page = null;
    if (viewedPageId) page = packet.pages?.get(viewedPageId) ?? null;
    if (!page || page.type !== "text") page = await getOrCreateFirstTextPage(packet, "Packet");

    const html = upsertSceneBlock(page.text?.content ?? "", scene);
    await page.update({ "text.content": html });
    wroteTo = `Page: ${page.name}`;
  }

  if (cfg.openScene) scene.sheet.render(true);
  if (cfg.activateScene) await scene.view();

  ui.notifications.info(`Created/Assigned Scene → ${scene.name} | ${wroteTo}`);
} catch (err) {
  console.error(err);
  ui.notifications.error(`Create Scene error: ${err?.message ?? err}`);
}
