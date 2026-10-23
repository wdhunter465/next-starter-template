import React from "react";
import { fetchPageContent } from "@/lib/pageContent";

export default async function Page() {
  const data = await fetchPageContent("/contact");
  const sections = data?.sections;

  const title = sections?.title?.content ?? "Contact";
  const leadHtml = sections?.lead_html?.content ?? null;
  const bodyHtml = sections?.body_html?.content ?? null;

  const supportEmail = "Support@LouGehrigFanClub.com";
  const adminEmail = "admin@lougehrigfanclub.com";

  return (
    <main style={styles.main}>
      <h1 style={styles.h1}>{title}</h1>

      {/* Always show the two official contact addresses (design requirement). */}
      <section style={styles.contactBlock} aria-label="Contact emails">
        <p style={styles.p}>
          <strong>Support:</strong>{" "}
          <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
        </p>
        <p style={styles.p}>
          <strong>Admin:</strong>{" "}
          <a href={`mailto:${adminEmail}`}>{adminEmail}</a>
        </p>
      </section>

      {leadHtml ? (
        <p style={styles.lead} dangerouslySetInnerHTML={{ __html: leadHtml }} />
      ) : (
        <>
          <p style={styles.lead}>
            The Lou Gehrig Fan Club is fan-run. Email is the fastest way to reach us for questions, source corrections, contributions, or partnerships.
          </p>
          <p style={styles.p}>
            Email Admin with questions and for anything that is not a problem report. Email Support for help with a problem or to report a broken feature. If you are unsure, email Admin and we will route your note.
          </p>
        </>
      )}

      {bodyHtml ? (
        <div style={styles.body} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      ) : (
        <>
          <h2 style={styles.h2}>Good reasons to email</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>You found an error and can provide a source to correct it.</li>
            <li style={styles.li}>You want to contribute photos, clippings, memorabilia, or a sourced story for club review.</li>
            <li style={styles.li}>You are coordinating ALS awareness or Lou Gehrig Day community activity. This is not a live LGFC website fundraiser campaign.</li>
            <li style={styles.li}>You want to suggest a charity, event, or community partner.</li>
          </ul>

          <h2 style={styles.h2}>What to include</h2>
          <ul style={styles.ul}>
            <li style={styles.li}>A short subject line (e.g., “Photo submission”, “Correction”, “Partnership”).</li>
            <li style={styles.li}>Links to sources or attachments (if you have them).</li>
            <li style={styles.li}>Any usage notes (credit line, rights, or how we should attribute the item).</li>
          </ul>
        </>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { padding: "40px 16px", maxWidth: 900, margin: "0 auto" },
  h1: { fontSize: 32, lineHeight: 1.2, margin: "0 0 32px 0" },
  h2: { fontSize: 24, lineHeight: 1.3, margin: "40px 0 16px 0" },
  lead: { fontSize: 18, lineHeight: 1.6, margin: "0 0 18px 0" },
  body: { fontSize: 16, lineHeight: 1.7 },
  p: { fontSize: 16, lineHeight: 1.7, margin: "0 0 10px 0" },
  contactBlock: {
    border: "1px solid rgba(0,0,0,0.12)",
    borderRadius: 10,
    padding: 14,
    margin: "0 0 18px 0",
  },
  ul: { paddingLeft: 18, margin: "0 0 14px 0" },
  li: { margin: "0 0 8px 0", lineHeight: 1.6 },
};
