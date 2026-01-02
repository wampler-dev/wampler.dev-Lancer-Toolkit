/**
 * Packet → Spawn Encounter from Templates (v1)
 * Foundry VTT v12
 * Packet-scoped, reversible via flags.lancer.spawnRecords
 */
(async () => {
  const FLAG_SCOPE = "lancer";
  const FLAG_PACKET_SCENE = "packetSceneId";
  const FLAG_PACKET_FOLDER = "packetActorFolderId";
  const FLAG_SPAWN_RECORDS = "spawnRecords";

  // ---------- helpers ----------
  const notify = (m) => ui.notifications?.info(m);
  const warn = (m) => ui.notifications?.warn(m);
  const err  = (m) => ui.notifications?.error(m);

  function uuid() {
    return foundry.utils.randomID(16);
  }

  function getCurrentJournalEntry() {
    // Best effort: open sheet, or controlled journal, or last viewed
    const app = Object.values(ui.windows).find(w => w?.document?.documentName === "JournalEntry" && w._state === Application.RENDER_STATES.RENDERED);
    if (app?.document) return app.document;

    const controlled = canvas?.hud?.journal?.journalEntry; // usually undefined
    if (controlled) return controlled;

    // fallback: selected in sidebar
    const li = ui.journal?.element?.find("li.journal-entry.selected");
    if (li?.length) return game.journal.get(li.data("documentId"));

    return null;
  }

  async function ensurePacketFolder(packetJE) {
    const folderId = packetJE.getFlag(FLAG_SCOPE, FLAG_PACKET_FOLDER);
    if (folderId) {
      const f = game.folders.get(folderId);
      if (f && f.type === "Actor") return f;
    }

    // Create a folder if missing (keeps it packet-scoped)
    const name = `${packetJE.name} — Actors`;
    const folder = await Folder.create({ name, type: "Actor", parent: null });
    await packetJE.setFlag(FLAG_SCOPE, FLAG_PACKET_FOLDER, folder.id);
    return folder;
  }

  async function resolveBoundScene(packetJE) {
    const sceneId = packetJE.getFlag(FLAG_SCOPE, FLAG_PACKET_SCENE);
    if (!sceneId) return null;
    return game.scenes.get(sceneId) ?? null;
  }

  async function listCompendiumActorPacks() {
    return game.packs
      .filter(p => p.documentName === "Actor")
      .map(p => ({ collection: p.collection, label: p.metadata.label }));
  }

  async function loadTemplatesFromCompendium(packCollection) {
    const pack = game.packs.get(packCollection);
    if (!pack) throw new Error(`Missing compendium: ${packCollection}`);
    const index = await pack.getIndex({ fields: ["name", "type"] });
    return index.contents.map(e => ({ id: e._id, name: e.name, type: e.type, pack: pack.collection }));
  }

  function loadTemplatesFromFolder(folderId) {
    const folder = game.folders.get(folderId);
    if (!folder || folder.type !== "Actor") return [];
    return folder.contents.map(a => ({ id: a.id, name: a.name, type: a.type, pack: null }));
  }

  async function getActorFromTemplate(tpl) {
    if (tpl.pack) {
      const pack = game.packs.get(tpl.pack);
      return await pack.getDocument(tpl.id);
    }
    return game.actors.get(tpl.id);
  }

  async function spawnCopiesIntoFolder(templateActor, folder, count, nameMode) {
    const created = [];
    for (let i = 1; i <= count; i++) {
      const base = templateActor.toObject();

      // strip identifiers
      delete base._id;
      delete base.folder;

      let newName = templateActor.name;
      if (nameMode === "suffix") newName = `${templateActor.name} ${i}`;
      if (nameMode === "prefix") newName = `${i}× ${templateActor.name}`;

      base.name = newName;
      base.folder = folder.id;

      // mark provenance on the new actor for audit
      base.flags = base.flags ?? {};
      base.flags[FLAG_SCOPE] = base.flags[FLAG_SCOPE] ?? {};
      base.flags[FLAG_SCOPE].spawnedFrom = {
        name: templateActor.name,
        uuid: templateActor.uuid
      };

      const a = await Actor.create(base, { renderSheet: false });
      created.push(a.id);
    }
    return created;
  }

  async function dropTokens(scene, actorIds, mode) {
    // mode: "none" | "stack" | "grid"
    if (!scene || mode === "none") return [];

    const createdTokenRefs = [];
    const tokenData = [];

    // pick a starting point near scene center
    const cx = Math.floor(scene.width / 2);
    const cy = Math.floor(scene.height / 2);

    // grid spacing
    const step = scene.grid.size;

    let idx = 0;
    for (const actorId of actorIds) {
      const a = game.actors.get(actorId);
      if (!a) continue;

      const proto = await a.getTokenDocument();
      const td = proto.toObject();
      delete td._id;

      let x = cx, y = cy;
      if (mode === "stack") {
        x = cx; y = cy;
      } else if (mode === "grid") {
        const row = Math.floor(idx / 6);
        const col = idx % 6;
        x = cx + col * step;
        y = cy + row * step;
      }
      td.x = x;
      td.y = y;

      tokenData.push(td);
      idx++;
    }

    if (!tokenData.length) return [];

    const created = await scene.createEmbeddedDocuments("Token", tokenData);
    for (const t of created) createdTokenRefs.push({ sceneId: scene.id, tokenId: t.id });
    return createdTokenRefs;
  }

  function renderDialog({ packs, actorFolders }) {
    const packOptions = packs.map(p => `<option value="${p.collection}">${p.label}</option>`).join("");
    const folderOptions = actorFolders.map(f => `<option value="${f.id}">${f.name}</option>`).join("");

    return new Promise((resolve) => {
      new Dialog({
        title: "Spawn Encounter from Templates (Packet-scoped)",
        content: `
<form>
  <div class="form-group">
    <label>Template Source</label>
    <select name="sourceMode">
      <option value="compendium" selected>Compendium (recommended)</option>
      <option value="folder">Actor Folder (world)</option>
    </select>
  </div>

  <div class="form-group">
    <label>Actor Compendium</label>
    <select name="pack">${packOptions}</select>
    <p class="notes">Choose a compendium containing template Actors.</p>
  </div>

  <div class="form-group">
    <label>Actor Folder (if Folder source)</label>
    <select name="folder">${folderOptions}</select>
    <p class="notes">Choose a world folder containing template Actors.</p>
  </div>

  <hr/>

  <div class="form-group">
    <label>Template filter</label>
    <input type="text" name="filter" placeholder="optional name contains..."/>
  </div>

  <div class="form-group">
    <label>Copies per template</label>
    <input type="number" name="count" value="1" min="1" step="1"/>
  </div>

  <div class="form-group">
    <label>Naming</label>
    <select name="nameMode">
      <option value="suffix" selected>Suffix (Template 1, Template 2...)</option>
      <option value="prefix">Prefix (1× Template)</option>
      <option value="none">Exact (no numbering)</option>
    </select>
  </div>

  <div class="form-group">
    <label>Token placement (bound packet scene)</label>
    <select name="placeTokens">
      <option value="none" selected>Do not place tokens</option>
      <option value="stack">Place tokens stacked (same spot)</option>
      <option value="grid">Place tokens in small grid</option>
    </select>
  </div>

  <div class="form-group">
    <label>Spawn label</label>
    <input type="text" name="label" value="Spawn ${new Date().toLocaleString()}"/>
  </div>
</form>
        `,
        buttons: {
          ok: {
            label: "Spawn",
            callback: (html) => {
              const fd = new FormDataExtended(html.find("form")[0]).object;
              resolve({ ok: true, data: fd });
            }
          },
          cancel: { label: "Cancel", callback: () => resolve({ ok: false }) }
        },
        default: "ok"
      }).render(true);
    });
  }

  // ---------- main ----------
  const packetJE = getCurrentJournalEntry();
  if (!packetJE) return err("Open or select the packet Journal Entry (B## or C##) before spawning.");

  const packetFolder = await ensurePacketFolder(packetJE);
  const boundScene = await resolveBoundScene(packetJE);

  const packs = await listCompendiumActorPacks();
  const actorFolders = game.folders.filter(f => f.type === "Actor");

  if (!packs.length && !actorFolders.length) {
    return err("No Actor compendiums or Actor folders found to use as template sources.");
  }

  const dlg = await renderDialog({ packs, actorFolders });
  if (!dlg.ok) return;

  const {
    sourceMode,
    pack,
    folder,
    filter,
    count,
    nameMode,
    placeTokens,
    label
  } = dlg.data;

  const copies = Math.max(1, Number(count || 1));

  // gather template list
  let templates = [];
  if (sourceMode === "folder") {
    templates = loadTemplatesFromFolder(folder);
    if (!templates.length) return warn("Selected folder has no Actors.");
  } else {
    templates = await loadTemplatesFromCompendium(pack);
    if (!templates.length) return warn("Selected compendium has no Actors.");
  }

  const f = String(filter || "").trim().toLowerCase();
  if (f) templates = templates.filter(t => t.name.toLowerCase().includes(f));

  if (!templates.length) return warn("No templates matched your filter.");

  // Spawn
  const createdActorIds = [];
  const sourceInfo = { sourceMode, pack: sourceMode === "compendium" ? pack : null, folder: sourceMode === "folder" ? folder : null, filter: f, copies };

  for (const tpl of templates) {
    const templateActor = await getActorFromTemplate(tpl);
    if (!templateActor) continue;

    const ids = await spawnCopiesIntoFolder(templateActor, packetFolder, copies, nameMode);
    createdActorIds.push(...ids);
  }

  // Place tokens if requested
  const createdTokenRefs = await dropTokens(boundScene, createdActorIds, placeTokens);

  // Save spawn record on packet
  const record = {
    id: uuid(),
    ts: Date.now(),
    label: label || `Spawn ${new Date().toLocaleString()}`,
    packetActorFolderId: packetFolder.id,
    packetSceneId: boundScene?.id ?? null,
    source: sourceInfo,
    createdActorIds,
    createdTokenRefs
  };

  const existing = packetJE.getFlag(FLAG_SCOPE, FLAG_SPAWN_RECORDS) ?? [];
  existing.push(record);
  await packetJE.setFlag(FLAG_SCOPE, FLAG_SPAWN_RECORDS, existing);

  notify(`Spawned ${createdActorIds.length} actor(s)` + (createdTokenRefs.length ? ` and placed ${createdTokenRefs.length} token(s).` : "."));
})();
