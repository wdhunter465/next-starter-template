'use client';

import React, { useState } from 'react';
import { adminJson } from '@/lib/adminClient';
import { buildRenditionPayload } from '@/lib/renditionGeneration';

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.18)',
    background: disabled ? 'rgba(0,0,0,0.05)' : 'white',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: 700,
  };
}

export default function RenditionGenerationControl(props: {
  storyId: number;
  mediaId: number;
  url?: string | null;
  onStatus: (message: string) => void;
  actionsEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    if (!props.url) {
      props.onStatus(`Media ${props.mediaId} has no source URL to generate renditions from.`);
      return;
    }
    setBusy(true);
    props.onStatus(`Generating renditions for media ${props.mediaId}…`);
    try {
      const built = await buildRenditionPayload(props.mediaId, props.url);
      if (!built.ok) {
        props.onStatus(`Error generating renditions for media ${props.mediaId}: ${built.error}`);
        return;
      }
      const result = await adminJson<{ ok: true; renditions: Array<{ size: string; status: string; error?: string }> }>(
        '/api/admin/editorial/media-associations',
        {
          method: 'POST',
          body: JSON.stringify({ action: 'persist_renditions', story_id: props.storyId, renditions: built.items }),
        },
      );
      if (!result.ok || !result.data) {
        props.onStatus(`Error persisting renditions for media ${props.mediaId}: ${result.error}`);
        return;
      }
      const failed = result.data.renditions.filter((r) => r.status !== 'ready');
      if (failed.length) {
        const detail = failed.map((r) => `${r.size}${r.error ? ` (${r.error})` : ''}`).join(', ');
        props.onStatus(`Media ${props.mediaId}: ${failed.length} of ${result.data.renditions.length} rendition(s) failed to persist: ${detail}`);
        return;
      }
      props.onStatus(`Media ${props.mediaId}: all ${result.data.renditions.length} rendition sizes generated and persisted.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={() => void generate()} disabled={!props.actionsEnabled || busy || !props.url} style={buttonStyle(!props.actionsEnabled || busy || !props.url)}>
      {busy ? 'Generating…' : 'Generate & Save Renditions'}
    </button>
  );
}
