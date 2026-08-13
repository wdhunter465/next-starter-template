'use client';

// Prototype component for #3164 (feeds #2857). Not imported by any route yet.
// Design notes: docs/ops/reports/photo-lightbox-prototype-design-3164.md

import { useRef, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

export type PhotoLightboxItem = {
  id: number;
  url?: string;
  thumbnail_url?: string;
  title?: string | null;
  description?: string | null;
};

export type PhotoLightboxGridProps = {
  items: readonly PhotoLightboxItem[];
};

// Matches the alt/title fallback already used by the real gallery page
// (src/app/fanclub/photo/page.tsx): title, then description, then a stable placeholder.
export function photoDisplayText(item: PhotoLightboxItem): string {
  return item.title || item.description || `Photo #${item.id}`;
}

export default function PhotoLightboxGrid({ items }: PhotoLightboxGridProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const lastOpenIndexRef = useRef<number | null>(null);
  const triggerRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const slides = items.map((item) => ({
    src: item.url || item.thumbnail_url || '',
    alt: photoDisplayText(item),
  }));

  function openAt(index: number) {
    lastOpenIndexRef.current = index;
    setOpenIndex(index);
  }

  function handleClose() {
    setOpenIndex(null);
    const index = lastOpenIndexRef.current;
    if (index !== null) {
      triggerRefs.current.get(index)?.focus();
    }
  }

  return (
    <div>
      <div data-testid="photo-thumbnail-grid">
        {items.map((item, index) => {
          const thumbnailUrl = item.thumbnail_url || item.url;
          const label = photoDisplayText(item);
          return (
            <button
              key={item.id}
              type="button"
              ref={(el) => {
                if (el) triggerRefs.current.set(index, el);
                else triggerRefs.current.delete(index);
              }}
              onClick={() => openAt(index)}
              aria-label={`Open ${label}`}
            >
              {thumbnailUrl ? <img src={thumbnailUrl} alt={label} /> : <span>Photo media unavailable</span>}
            </button>
          );
        })}
      </div>
      <Lightbox open={openIndex !== null} close={handleClose} index={openIndex ?? 0} slides={slides} />
    </div>
  );
}
