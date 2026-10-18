/**
 * Scroll behavior that honors the visitor's reduced-motion setting (#4624).
 * CSS `scroll-behavior` is covered by the global rule in globals.css; script-driven
 * smooth scrolling has to ask the browser itself.
 */
export function motionSafeScrollBehavior(): ScrollBehavior {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'auto';
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
