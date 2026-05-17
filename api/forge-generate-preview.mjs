export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { generationInput } = req.body || {};

    if (!generationInput || typeof generationInput !== 'object') {
      return res.status(400).json({
        ok: false,
        error: 'Missing generationInput'
      });
    }

    if (!generationInput.rebelId || !generationInput.collectionKey || !generationInput.sourceImage) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required Forge generation fields'
      });
    }

    const previewPlan = {
      previewVersion: 'v1',
      requestAccepted: true,
      rebelId: generationInput.rebelId || null,
      tokenId: generationInput.tokenId || null,
      collectionKey: generationInput.collectionKey || null,
      sourceFraming: generationInput.sourceFraming || 'unknown',
      targetOutput: generationInput.targetOutput || 'full_body_3d_character',
      requiresFullBodyCompletion: generationInput.requiresFullBodyCompletion === true,
      bodyType: generationInput.bodyType || 'universal_ant_v1',
      colony: generationInput.colony || null,
      colonyStyle: generationInput.colonyProfile?.baseStyle || null,
      weaponFamily: generationInput.weaponProfile?.family || null,
      sourceImage: generationInput.sourceImage || null,
      summary: {
        traitSlotCount: Object.keys(generationInput.traitSlots || {}).filter(key => generationInput.traitSlots[key]).length,
        forgeLayerGroups: Object.keys(generationInput.forgeLayers || {}),
        hasSourceTraits: Object.keys(generationInput.sourceTraits || {}).length > 0
      },
      nextStep: 'ready_for_preview_generator'
    };

    return res.status(200).json({
      ok: true,
      generated: true,
      mode: 'preview_stub',
      message: 'Forge preview request accepted.',
      previewPlan
    });
  } catch (err) {
    console.error('forge-generate-preview error:', err);

    return res.status(500).json({
      ok: false,
      error: 'Could not generate Forge preview'
    });
  }
}
