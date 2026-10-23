'use client';

import { useCallback, useEffect, useState } from 'react';
import ClubHomeStaticStory from '@/components/fanclub/ClubHomeStaticStory';
import type { ClubStagingRotationItem } from './clubStagingSamples';

type ClubStagingRotationPreviewProps = {
  items: ClubStagingRotationItem[];
};

export default function ClubStagingRotationPreview({ items }: ClubStagingRotationPreviewProps) {
  const count = items.length;
  const [index, setIndex] = useState(0);
  const [timerEpoch, setTimerEpoch] = useState(0);

  useEffect(() => {
    if (index >= count) {
      setIndex(count > 0 ? count - 1 : 0);
    }
  }, [count, index]);

  const safeIndex = count > 0 ? Math.min(index, count - 1) : 0;
  const current = items[safeIndex];
  const canRotate = count > 1;

  const goPrev = useCallback(() => {
    if (!canRotate) return;
    setIndex((prev) => (prev - 1 + count) % count);
    setTimerEpoch((prev) => prev + 1);
  }, [canRotate, count]);

  const goNext = useCallback(() => {
    if (!canRotate) return;
    setIndex((prev) => (prev + 1) % count);
    setTimerEpoch((prev) => prev + 1);
  }, [canRotate, count]);

  useEffect(() => {
    if (!canRotate) return undefined;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % count);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [canRotate, count, timerEpoch]);

  if (!current) return null;

  return (
    <section aria-label="Club staging rotation preview">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, color: 'var(--lgfc-blue, #003366)' }}>Rotation preview</h2>
        {canRotate ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" onClick={goPrev} aria-label="Previous rotation item">
              Previous
            </button>
            <span aria-live="polite" style={{ fontSize: 14, color: 'rgba(0,0,0,0.7)' }}>
              {safeIndex + 1} of {count}
            </span>
            <button type="button" onClick={goNext} aria-label="Next rotation item">
              Next
            </button>
          </div>
        ) : null}
      </div>

      <ClubHomeStaticStory
        ariaLabel={`Rotation preview item ${safeIndex + 1}`}
        title={current.title}
        headline={current.headline}
        summary={current.summary}
        credit={current.credit}
        sourceName={current.sourceName}
      />
    </section>
  );
}
