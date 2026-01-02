/**
 * Packet → Undo Spawn (v1)
 * Removes actors/tokens created by a prior spawn record stored on the packet journal.
 */
(async () => {
  const FLAG_SCOPE = "lancer";
  const FLAG_SPAWN_RECORDS = "spawnRecords";

  const notify = (m) => ui.notifications?.info(m);
  const warn = (m) => ui.notifications?.warn(m);
  const err  = (m) => ui.notifications?.error(m);

  function getCurrentJournalEntry() {
    const app = Object.values(ui.windows).find(w => w?.document?.documentName === "JournalEntry" && w._state === Application.RENDER_STATES.RENDERED);
    if (app?.document) return app.document;

    const li = ui.journal?.element?.find("li.journal-entry.selected");
    if (li?.length) return game.journal.get(li.data("documentId"));

    return null;
  }

  const packetJE = getCurrentJournalEntry();
  if (!packetJE) return err("Open or select the packet Journal Entry (B## or C##) before undoing a spawn.");

  const records = packetJE.getFlag(FLAG_SCOPE, FLAG_SPAWN_RECORDS) ?? [];
  if (!records.length) return warn("No spawn records found on this packet.");

  // Build a picker
  const options = records
    .slice()
    .reverse()
    .map(r => {
      const when = new Date(r.ts).toLocaleString();
      const aN = r.createdActorIds?.length ?? 0;
      const tN = r.createdTokenRefs?.length ?? 0;
      return `<option value="${r.id}">${r.label} — ${when} (${aN} actors, ${tN} tokens)</option>`;
    }).join("");

  const chosen = await new Promise((resolve) => {
    new Dialog({
      title: "Undo Spawn (Packet-scoped)",
      content: `
<form>
  <div class="form-group">
    <label>Spawn record</label>
    <select name="id">${options}</select>
  </div>
  <p class="notes">This deletes only the actors/tokens created by the chosen record.</p>
</form>`,
      buttons: {
        ok: { label: "Undo", callback: (html) => resolve(new FormDataExtended(html.find("form")[0]).object.id) },
        cancel: { label: "Cancel", callback: () => resolve(null) }
      },
      default: "ok"
    }).render(true);
  });

  if (!chosen) return;

  const idx = records.findIndex(r => r.id === chosen);
  if (idx < 0) return err("Selected record not found.");

  const record = records[idx];

  // 1) Delete tokens (group by scene)
  const refs = record.createdTokenRefs ?? [];
  const byScene = refs.reduce((m, r) => {
    (m[r.sceneId] ??= []).push(r.tokenId);
    return m;
  }, {});

  for (const [sceneId, tokenIds] of Object.entries(byScene)) {
    const scene = game.scenes.get(sceneId);
    if (!scene) continue;

    const existingIds = tokenIds.filter(tid => scene.tokens.get(tid));
    if (existingIds.length) {
      await scene.deleteEmbeddedDocuments("Token", existingIds);
    }
  }

  // 2) Delete actors
  const actorIds = (record.createdActorIds ?? []).filter(aid => game.actors.get(aid));
  if (actorIds.length) {
    await Actor.deleteDocuments(actorIds);
  }

  // 3) Remove record
  records.splice(idx, 1);
  await packetJE.setFlag(FLAG_SCOPE, FLAG_SPAWN_RECORDS, records);

  notify("Undo complete.");
})();
