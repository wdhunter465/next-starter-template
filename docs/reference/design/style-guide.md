---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: Routes, navigation invariants, UI/UX contracts, page content contracts
Does Not Own: How-to procedures; operational runbooks; governance policies
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-10-22
---

# LGFC Website Style Guide

## Brand

**Lou Gehrig Fan Club** — Public Cloudflare Site

This style guide establishes consistent visual standards for the LGFC website, ensuring a cohesive and professional appearance across all pages and components.

---

## Font Stack

Use a single, consistent font stack across the entire site:

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif;
```

This system font stack provides optimal performance and native appearance on all platforms while maintaining excellent readability.

---

## Color Palette

### Primary Colors

- **LGFC Blue** (`#0033cc`)
  - Primary brand color
  - Used for: primary buttons, key headings, primary CTAs, important links
  - Hover state: `#0028a3` (slightly darker)

- **Deep Navy** (`#001a66`)
  - Optional darker shade for emphasis
  - Used for: alternative headings when needed, dark accents

### Text Colors

- **Body Text** (`#333333`)
  - Primary text color for paragraphs and content
  - High contrast for readability

- **Muted Text** (`#666666`)
  - Used for: metadata, timestamps, captions, disclaimers
  - Secondary information that needs less emphasis

- **Light Muted** (`#999999`)
  - Used for: placeholder text, very subtle hints
  - Lowest emphasis text

### Background Colors

- **Page Background** (`#f5f7fb`)
  - Main page background
  - Soft, light neutral that reduces eye strain

- **Card Background** (`#ffffff`)
  - Cards, sections, and elevated content
  - Pure white for maximum contrast with page background

- **Subtle Background** (`#f8f9ff`)
  - Alternative card background for variety
  - Very light blue tint for subtle differentiation

### Border Colors

- **Border Soft** (`#dde3f5`)
  - Primary border color for cards and dividers
  - Subtle separation without harsh lines

- **Border Light** (`#e8ecf5`)
  - Even lighter border for internal separations
  - Minimal visual weight

---

## Typography Scale

### Headings

- **Hero H1** (Homepage main heading)
  - Base: `48px` (3rem)
  - From 640px: `64px` (4rem)
  - Large Desktop (1024px+): `72px` (4.5rem)
  - Updated 2026-10-14 to the built sizes (Product Authority, #4409, D-008)
  - Font weight: `700` (bold)
  - Color: `#ffffff` (on blue background)
  - Line height: `1.2`

- **Page Title H1**
  - One size at every width: `32px` (2rem). Accepted 2026-10-14 (#4409, D-010)
  - Font weight: `700`
  - Color: LGFC Blue (`#0033cc`)
  - Line height: `1.2`

- **Section H2**
  - Size: `24px` (1.5rem)
  - Mobile minimum: `22px` (1.375rem)
  - Font weight: `700`
  - Color: LGFC Blue (`#0033cc`)
  - Line height: `1.3`

- **Subheading / Card Title H3**
  - Size: `18px` (1.125rem)
  - Font weight: `600`
  - Color: Body Text (`#333333`)
  - Line height: `1.4`

### Body Text

- **Body / Paragraph**
  - Size: `16px` (1rem)
  - Mobile: `15px` (0.9375rem)
  - Font weight: `400` (normal)
  - Color: Body Text (`#333333`)
  - Line height: `1.6`

- **Small / Meta Text**
  - Size: `14px` (0.875rem)
  - Font weight: `400`
  - Color: Muted Text (`#666666`)
  - Line height: `1.5`

- **Fine Print**
  - Size: `13px` (0.8125rem)
  - Font weight: `400`
  - Color: Muted Text (`#666666`)
  - Line height: `1.4`

---

## Buttons

### Primary Buttons

Primary buttons are used for the most important actions (Join, Login, Vote).

```css
background-color: #0033cc;  /* LGFC Blue */
color: #ffffff;
padding: 10px 16px;
border-radius: 12px;
border: none;
font-size: 14px;
font-weight: 600;
cursor: pointer;
transition: background-color 0.2s ease;
```

**Hover State:**
```css
background-color: #0028a3;  /* Slightly darker blue */
```

**Focus State:**
- Add visible focus ring for accessibility
- `outline: 2px solid #0033cc; outline-offset: 2px;`

### Secondary Buttons

Secondary buttons for less prominent actions.

```css
background-color: #ffffff;
color: #0033cc;
padding: 10px 16px;
border-radius: 12px;
border: 1px solid rgba(0, 51, 204, 0.3);
font-size: 14px;
font-weight: 600;
cursor: pointer;
transition: opacity 0.2s ease;
```

**Hover State:**
```css
opacity: 0.9;
```

### Button States

- **Disabled:** `opacity: 0.5; cursor: not-allowed;`
- **Loading:** Show spinner, maintain dimensions

---

## Links

### Text Links (In Content)

Standard text links within paragraphs and content areas.

```css
color: #0033cc;  /* LGFC Blue */
text-decoration: none;
transition: text-decoration 0.15s ease;
```

**Hover State:**
```css
text-decoration: underline;
```

**Visited State:**
- Keep same color (LGFC Blue) for consistency

### Navigation Links

Links in the header navigation and footer.

```css
color: #0033cc;
text-decoration: none;
font-size: 14px;
font-weight: 500;
```

**Hover State:**
```css
opacity: 0.8;
/* OR */
text-decoration: underline;
```

---

## Spacing & Layout

### Section Spacing

- **Large gap:** `48px` (3rem) - Between major page sections
- **Medium gap:** `32px` (2rem) - Between related subsections
- **Small gap:** `20px` (1.25rem) - Between closely related elements

### Container

- **Max width:** `1200px`
- **Horizontal padding:** `20px` (desktop), `16px` (mobile)
- **Center aligned:** `margin: 0 auto;`

### Border Radius

- **Large cards:** `18px` (hero sections, main banners)
- **Standard cards:** `14px` (content cards, tiles)
- **Small elements:** `12px` (buttons, inputs)
- **Pill buttons:** `999px` (fully rounded)

---

## Accessibility Guidelines

### Color Contrast

All text must meet WCAG AA standards:
- Normal text: minimum 4.5:1 contrast ratio
- Large text (18px+ or 14px+ bold): minimum 3:1 contrast ratio

### Focus States

All interactive elements must have visible focus indicators for keyboard navigation.

### Responsive Typography

- Font sizes should scale smoothly between breakpoints
- Maintain readable minimum sizes (no smaller than 13px for body text)
- Preserve visual hierarchy at all screen sizes

---

## Usage Examples

### Hero Section
```css
background: #0033cc;
color: #ffffff;
font-size: 3rem; /* 4rem from 640px, 4.5rem from 1024px */
font-weight: 700;
```

### Section Heading
```css
color: #0033cc;
font-size: 1.5rem;
font-weight: 700;
text-align: center;
margin-bottom: 20px;
```

### Card Container
```css
background: #ffffff;
border: 1px solid #dde3f5;
border-radius: 14px;
padding: 20px;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
```

---

## Maintenance

This style guide should be updated whenever:
- New color variants are needed
- Typography requirements change
- New component patterns emerge
- Accessibility standards evolve

All changes should maintain consistency with the established LGFC brand identity and prioritize user experience and accessibility.
