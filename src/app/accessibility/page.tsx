import React from "react";

/**
 * Product-approved accessibility statement (#2920 / Product Decision item 6).
 * Wording approved as written 2026-08-12. Hardcoded so CMS absence cannot omit it.
 */
export default function Page() {
  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>Accessibility</h1>

      <p style={styles.lead}>
        The Lou Gehrig Fan Club website is a fan-run site. We aim to make public pages usable by as many
        people as possible, including people who use assistive technologies.
      </p>

      <h2 style={styles.h2}>Our approach</h2>
      <p style={styles.p}>
        We design and build toward the Web Content Accessibility Guidelines (WCAG) 2.x Level AA as our
        internal standard. In practice that includes:
      </p>
      <ul style={styles.ul}>
        <li style={styles.li}>Text and interactive controls intended to meet AA contrast targets</li>
        <li style={styles.li}>Visible focus indicators for keyboard navigation where we control the UI</li>
        <li style={styles.li}>Readable typography and layout that adapts across common screen sizes</li>
        <li style={styles.li}>Semantic structure (headings, labels, and links) on pages we author</li>
      </ul>
      <p style={styles.p}>
        Some content is historical, member-submitted, or embedded from third parties. Those areas may not
        always meet the same standard. We improve issues as we find them and as capacity allows.
      </p>

      <h2 style={styles.h2}>How to report a problem</h2>
      <p style={styles.p}>
        If you have trouble using any part of this site, please email{" "}
        <strong>admin@lougehrigfanclub.com</strong> with:
      </p>
      <ul style={styles.ul}>
        <li style={styles.li}>The page URL</li>
        <li style={styles.li}>A short description of the problem</li>
        <li style={styles.li}>The browser, device, or assistive technology you were using (if you know it)</li>
      </ul>
      <p style={styles.p}>
        We will do our best to respond and to address barriers that are within our control.
      </p>

      <h2 style={styles.h2}>Limitations</h2>
      <p style={styles.p}>
        This statement describes our intent and process. It is not a formal accessibility certification or a
        warranty that every page is free of barriers at all times.
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { padding: "40px 16px", maxWidth: 900, margin: "0 auto" },
  h1: { fontSize: 34, lineHeight: 1.15, margin: "0 0 12px 0" },
  h2: { fontSize: 22, lineHeight: 1.25, margin: "22px 0 10px 0" },
  lead: { fontSize: 18, lineHeight: 1.6, margin: "0 0 18px 0" },
  p: { fontSize: 16, lineHeight: 1.7, margin: "0 0 14px 0" },
  ul: { paddingLeft: 18, margin: "0 0 14px 0" },
  li: { margin: "0 0 8px 0", lineHeight: 1.6 },
};
