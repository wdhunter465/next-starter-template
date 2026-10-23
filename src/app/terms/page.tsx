import React from "react";
import { fetchPageContent } from "@/lib/pageContent";
import { buildCanonicalMetadata } from '@/lib/publicSiteMetadata';

export const metadata = buildCanonicalMetadata('/terms/');

export default async function Page() {
  const data = await fetchPageContent("/terms");
  const sections = data?.sections;

  const title = sections?.title?.content ?? "Terms";
  const leadHtml = sections?.lead_html?.content ?? null;
  const bodyHtml = sections?.body_html?.content ?? null;

  return (
    <main style={{ ...styles.main }}>
      <h1 style={{ ...styles.h1 }}>{title}</h1>

      {leadHtml ? (
        <p style={{ ...styles.lead }} dangerouslySetInnerHTML={{ __html: leadHtml }} />
      ) : (
        <p style={{ ...styles.lead }}>
          By using this site, you agree to basic rules that keep the community respectful and keep content lawful.
        </p>
      )}

      {bodyHtml ? (
        <div style={{ ...styles.body }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      ) : (
        <>
          <h2 style={{ ...styles.h2 }}>1) Respectful use</h2>
          <p style={{ ...styles.p }}>
            This is a legacy and history community. Harassment, hate, doxxing, and abusive behavior are not welcome.
            We reserve the right to remove content or restrict access if needed.
          </p>

          <h2 style={{ ...styles.h2 }}>2) User submissions</h2>
          <p style={{ ...styles.p }}>
            If you submit content (text or media), you confirm you have the right to share it and that it does not
            violate anyone’s rights. You grant the club permission to display and store the submission as part of the
            site archive, including edits for length/clarity and basic formatting.
          </p>

          <h2 style={{ ...styles.h2 }}>3) Copyright and attribution</h2>
          <p style={{ ...styles.p }}>
            Don’t upload copyrighted material you don’t own or have permission to share. If you’re sharing a quote or
            excerpt, keep it brief and include a source. We will remove content on valid rights requests.
          </p>

          <h2 style={{ ...styles.h2 }}>4) No warranties</h2>
          <p style={{ ...styles.p }}>
            The site is provided “as is.” We do our best to be accurate, but history content can contain errors.
            Verify important information with primary sources.
          </p>

          <h2 style={{ ...styles.h2 }}>5) Contact</h2>
          <p style={{ ...styles.p }}>
            Questions, corrections, or removal requests: <strong>admin@lougehrigfanclub.com</strong>.
          </p>
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
  p: { fontSize: 16, lineHeight: 1.7, margin: "0 0 14px 0" },
  ul: { paddingLeft: 18, margin: "0 0 14px 0" },
  li: { margin: "0 0 8px 0", lineHeight: 1.6 },
};
