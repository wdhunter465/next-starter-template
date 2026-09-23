import { describe, expect, it } from 'vitest';

import {
  getSocialFallbackPlatforms,
  hasRenderedSocialWidget,
  SOCIAL_WALL_WIDGET_ID,
} from '@/lib/socialFallbacks';

describe('socialFallbacks (#2044)', () => {
  it('defines fallback coverage for Facebook, Instagram, X, and Pinterest', () => {
    const ids = getSocialFallbackPlatforms().map((platform) => platform.id);
    expect(ids).toEqual(['facebook', 'instagram', 'x', 'pinterest']);
  });

  it('returns platform-origin links for every fallback entry', () => {
    for (const platform of getSocialFallbackPlatforms()) {
      expect(platform.href).toMatch(/^https:\/\//);
      expect(platform.label.length).toBeGreaterThan(0);
      expect(platform.reliabilityNote.length).toBeGreaterThan(0);
    }
  });

  it('keeps the Elfsight widget id stable for SocialWall', () => {
    expect(SOCIAL_WALL_WIDGET_ID).toContain('elfsight-app-');
  });

  it('detects rendered widget shells with iframe or child content', () => {
    const root = document.createElement('div');
    const widget = document.createElement('div');
    widget.className = SOCIAL_WALL_WIDGET_ID;
    root.appendChild(widget);
    expect(hasRenderedSocialWidget(root)).toBe(false);

    widget.appendChild(document.createElement('iframe'));
    expect(hasRenderedSocialWidget(root)).toBe(true);
  });

  it('detects Elfsight content painted into an open shadow root', () => {
    const root = document.createElement('div');
    const widget = document.createElement('div');
    widget.className = SOCIAL_WALL_WIDGET_ID;
    root.appendChild(widget);
    const shadow = widget.attachShadow({ mode: 'open' });
    shadow.appendChild(document.createElement('iframe'));
    expect(hasRenderedSocialWidget(root)).toBe(true);
  });

  it('detects a painted Elfsight host when children are hidden from light DOM', () => {
    const root = document.createElement('div');
    const widget = document.createElement('div');
    widget.className = SOCIAL_WALL_WIDGET_ID;
    Object.defineProperty(widget, 'clientHeight', { configurable: true, get: () => 320 });
    Object.defineProperty(widget, 'scrollHeight', { configurable: true, get: () => 320 });
    root.appendChild(widget);
    expect(hasRenderedSocialWidget(root)).toBe(true);
  });
});
