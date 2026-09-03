'use client';

import React, { useEffect, useId, useRef } from 'react';

export type PhotoDetailItem = {
  id: number;
  url?: string;
  thumbnail_url?: string;
  title?: string | null;
  description?: string | null;
  tags?: string | null;
  uploaded_by?: string | null;
  credit_line?: string | null;
  rights_owner?: string | null;
};

export type PhotoDetailPanelProps = {
  items: readonly PhotoDetailItem[];
  activeId: number | null;
  unavailable?: boolean;
  onClose: () => void;
  onNavigate: (id: number) => void;
};

export function photoDetailLabel(item: PhotoDetailItem): string {
  return item.title || item.description || `Photo #${item.id}`;
}

export default function PhotoDetailPanel({
  items,
  activeId,
  unavailable = false,
  onClose,
  onNavigate,
}: PhotoDetailPanelProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const index = items.findIndex((item) => item.id === activeId);
  const item = index >= 0 ? items[index] : null;
  const open = activeId !== null;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (!item || unavailable) return;
      if (event.key === 'ArrowRight' && index < items.length - 1) {
        event.preventDefault();
        onNavigate(items[index + 1].id);
      }
      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        onNavigate(items[index - 1].id);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previousFocusRef.current?.focus?.();
    };
  }, [open, item, unavailable, index, items, onClose, onNavigate]);

  if (!open) return null;

  const label = item ? photoDetailLabel(item) : `Photo #${activeId}`;
  const mediaUrl = item?.url || item?.thumbnail_url;
  const credit = item?.credit_line || item?.uploaded_by || null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="photo-detail-panel"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(0,0,0,0.72)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(920px, 100%)',
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.18)',
          background: '#0f172a',
          color: '#fff',
          padding: 16,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 22 }}>
            {label}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close photo detail"
            style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>

        {unavailable ? (
          <p data-testid="photo-detail-unavailable" style={{ marginTop: 18, opacity: 0.9 }}>
            This photo is unavailable or no longer published.
          </p>
        ) : !item ? (
          <p data-testid="photo-detail-loading" style={{ marginTop: 18, opacity: 0.9 }}>
            Loading photo detail…
          </p>
        ) : (
          <>
            <div style={{ marginTop: 14, aspectRatio: '4/3', background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center', borderRadius: 12, overflow: 'hidden' }}>
              {mediaUrl ? (
                <img src={mediaUrl} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ opacity: 0.8 }}>Photo media unavailable</span>
              )}
            </div>
            {item.description ? <p style={{ marginTop: 12, opacity: 0.9 }}>{item.description}</p> : null}
            {credit ? <p style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>Credit: {credit}</p> : null}
            {item.rights_owner ? <p style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>Rights: {item.rights_owner}</p> : null}
            {item.tags ? <p style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>Tags: {item.tags}</p> : null}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                type="button"
                disabled={index <= 0}
                onClick={() => onNavigate(items[index - 1].id)}
                aria-label="Previous photo"
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: index <= 0 ? 'not-allowed' : 'pointer', opacity: index <= 0 ? 0.45 : 1 }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={index >= items.length - 1}
                onClick={() => onNavigate(items[index + 1].id)}
                aria-label="Next photo"
                style={{ padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: '#fff', cursor: index >= items.length - 1 ? 'not-allowed' : 'pointer', opacity: index >= items.length - 1 ? 0.45 : 1 }}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
