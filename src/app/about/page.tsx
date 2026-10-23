import React from "react";

export default function AboutPage() {
  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>About the Lou Gehrig Fan Club</h1>
      <p style={styles.lead}>
        A fan-run community honoring Gehrig&apos;s legacy and the ALS fight ahead of our 2027 public relaunch
      </p>

      <h2 style={styles.h2}>About This Fan Club</h2>
      <p style={styles.p}>
        The Lou Gehrig Fan Club is a fan-run community for celebrating Lou Gehrig&apos;s legacy, preserving club history, and supporting ALS awareness.
        The public site is open to everyone; the member Fan Club area is available after Join or Login.
      </p>

      <h2 style={styles.h2}>What you&apos;ll find here</h2>
      <ul style={styles.ul}>
        <li style={styles.li}>Public Lou Gehrig history, milestones, and weekly photo voting</li>
        <li style={styles.li}>Approved public FAQs and a question intake path for moderator review</li>
        <li style={styles.li}>Upcoming events and calendar previews as launch content is finalized</li>
        <li style={styles.li}>Members-only Fan Club archives, discussions, and club activity after login</li>
      </ul>

      <h2 style={styles.h2}>How you can help</h2>
      <p style={styles.p}>
        We encourage support for trusted ALS research and advocacy organizations. The Lou Gehrig Fan Club website does not currently run a live
        fundraiser campaign on this site. Visit our Contact page to share corrections, contributions, partnerships, or Lou Gehrig Day coordination ideas.
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { padding: "40px 16px", maxWidth: 900, margin: "0 auto" },
  h1: { fontSize: 32, lineHeight: 1.2, margin: "0 0 32px 0" },
  h2: { fontSize: 24, lineHeight: 1.3, margin: "40px 0 16px 0" },
  lead: { fontSize: 18, lineHeight: 1.6, margin: "0 0 18px 0" },
  p: { fontSize: 16, lineHeight: 1.7, margin: "0 0 14px 0" },
  ul: { paddingLeft: 18, margin: "0 0 14px 0" },
  li: { margin: "0 0 8px 0", lineHeight: 1.6 },
};
