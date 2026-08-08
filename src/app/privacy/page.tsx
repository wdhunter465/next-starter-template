import React from "react";
import { fetchPageContent } from "@/lib/pageContent";

export default async function Page() {
  const data = await fetchPageContent("/privacy");
  const sections = data?.sections;

  const title = sections?.title?.content ?? "Privacy";
  const leadHtml = sections?.lead_html?.content ?? null;
  const bodyHtml = sections?.body_html?.content ?? null;

  return (
    <main style={{ ...styles.main }}>
      <h1 style={{ ...styles.h1 }}>{title}</h1>

      {leadHtml ? (
        <p style={{ ...styles.lead }} dangerouslySetInnerHTML={{ __html: leadHtml }} />
      ) : (
        <p style={{ ...styles.lead }}>
          This is a fan-run site. We collect the minimum information needed to operate Join/Login, Ask a
          Question, member verification, and content submissions.
        </p>
      )}

      {bodyHtml ? (
        <div style={{ ...styles.body }} dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      ) : (
        <>
          <h2 style={{ ...styles.h2 }}>What we collect</h2>
          <ul style={{ ...styles.ul }}>
            <li style={{ ...styles.li }}>
              Join / Login: first name, last name, optional screen name, email address, and optional email
              opt-in for updates.
            </li>
            <li style={{ ...styles.li }}>
              Ask a Question: first name, last name, optional screen name, email address, and the question
              text you submit for moderator review.
            </li>
            <li style={{ ...styles.li }}>
              Member creation and verification: when you Join or Ask with a new email, we may create a
              member record and send a welcome or transactional confirmation email related to that request.
            </li>
            <li style={{ ...styles.li }}>
              Session authentication: a short-lived session cookie used to keep you signed in to Fan Club
              member surfaces after Login.
            </li>
            <li style={{ ...styles.li }}>
              Library submissions: the content you submit, your provided name/email, and timestamps.
            </li>
            <li style={{ ...styles.li }}>
              Photo submissions (when enabled): the media URL, description/caption text you provide, and
              timestamps.
            </li>
            <li style={{ ...styles.li }}>
              Basic technical logs (for example request timing/errors) used for reliability, security, and
              rate limiting.
            </li>
          </ul>

          <h2 style={{ ...styles.h2 }}>How we use it</h2>
          <ul style={{ ...styles.ul }}>
            <li style={{ ...styles.li }}>
              To operate Join/Login and member access, including session cookies for authenticated Fan Club
              pages.
            </li>
            <li style={{ ...styles.li }}>
              To review and reply to Ask questions, and to add approved answers to the public FAQ when
              appropriate.
            </li>
            <li style={{ ...styles.li }}>
              To send email updates only when you explicitly opt in via Join (non-opted-in members may still
              receive strictly transactional confirmations related to their request).
            </li>
            <li style={{ ...styles.li }}>To publish and manage user submissions (Library and photo/media captions).</li>
            <li style={{ ...styles.li }}>To keep the site secure and functioning (rate limiting, troubleshooting).</li>
          </ul>

          <h2 style={{ ...styles.h2 }}>What we do not do</h2>
          <p style={{ ...styles.p }}>We do not sell personal information.</p>

          <h2 style={{ ...styles.h2 }}>Removal requests</h2>
          <p style={{ ...styles.p }}>
            To request removal of your email or a submission, contact: <strong>admin@lougehrigfanclub.com</strong>.
          </p>

          <p style={{ ...styles.p }}>
            This policy will be refined as features expand. When we add new data collection, we will update
            this page.
          </p>
        </>
      )}
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { padding: "40px 16px", maxWidth: 900, margin: "0 auto" },
  h1: { fontSize: 34, lineHeight: 1.15, margin: "0 0 12px 0" },
  h2: { fontSize: 22, lineHeight: 1.25, margin: "22px 0 10px 0" },
  lead: { fontSize: 18, lineHeight: 1.6, margin: "0 0 18px 0" },
  body: { fontSize: 16, lineHeight: 1.7 },
  p: { fontSize: 16, lineHeight: 1.7, margin: "0 0 14px 0" },
  ul: { paddingLeft: 18, margin: "0 0 14px 0" },
  li: { margin: "0 0 8px 0", lineHeight: 1.6 },
};
