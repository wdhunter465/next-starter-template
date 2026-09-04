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
              member surfaces after Login. We do not use magic-link authentication.
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
              To send email updates only when you explicitly opt in via Join. First-time Join or Ask
              requests may also receive a welcome email; other non-opted-in mail is limited to
              transactional confirmations related to that request.
            </li>
            <li style={{ ...styles.li }}>To publish and manage user submissions (Library and photo/media captions).</li>
            <li style={{ ...styles.li }}>To keep the site secure and functioning (rate limiting, troubleshooting).</li>
          </ul>

          <h2 style={{ ...styles.h2 }}>What we do not do</h2>
          <p style={{ ...styles.p }}>
            We do not sell personal information. We do not use magic-link authentication or verification.
          </p>

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

      {/* Always rendered so D1 body_html cannot omit the analytics disclosure (Product Decision item 2 / #2920). */}
      <h2 style={{ ...styles.h2 }}>Cookie &amp; Privacy Preferences</h2>
      <p style={{ ...styles.p }}>
        <strong>We do not sell your personal information.</strong>
      </p>
      <p style={{ ...styles.p }}>
        Any information retained by this website is used solely to operate the site, maintain security and
        signed-in sessions, remember your preferences, understand how the website is used, and improve content
        delivery and your overall experience while visiting the site.
      </p>

      <h3 style={{ ...styles.h3 }}>Essential website functions</h3>
      <p style={{ ...styles.p }}>
        Some cookies or browser storage may be required for core functions such as authentication, maintaining
        your signed-in session, security, and remembering necessary site preferences.
      </p>

      <h3 style={{ ...styles.h3 }}>Analytics</h3>
      <p style={{ ...styles.p }}>
        We may use analytics tools to understand aggregate website usage, such as which pages are visited and
        how visitors navigate the site. This information helps us improve content, performance, navigation, and
        the overall user experience. When analytics is enabled, we use Google Analytics 4 (gtag), and it does
        not run until you choose Accept on the analytics preference notice; choosing Decline keeps it off. Your
        choice is remembered on this browser/device so the notice does not reappear on later visits, unless you
        clear your site data.
      </p>

      <h3 style={{ ...styles.h3 }}>Optional features</h3>
      <p style={{ ...styles.p }}>
        Additional cookies or browser storage may be used only if and when optional website features that
        require them are enabled. Where applicable, their purpose will be identified and handled in accordance
        with the website&rsquo;s privacy practices.
      </p>

      <p style={{ ...styles.p }}>
        Independently of analytics, a short-lived session cookie is used only after Login to keep you signed
        in to Fan Club member surfaces. You can request removal of personal data you submitted by contacting{" "}
        <strong>admin@lougehrigfanclub.com</strong>.
      </p>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: { padding: "40px 16px", maxWidth: 900, margin: "0 auto" },
  h1: { fontSize: 34, lineHeight: 1.15, margin: "0 0 12px 0" },
  h2: { fontSize: 22, lineHeight: 1.25, margin: "22px 0 10px 0" },
  h3: { fontSize: 18, lineHeight: 1.3, margin: "16px 0 8px 0" },
  lead: { fontSize: 18, lineHeight: 1.6, margin: "0 0 18px 0" },
  body: { fontSize: 16, lineHeight: 1.7 },
  p: { fontSize: 16, lineHeight: 1.7, margin: "0 0 14px 0" },
  ul: { paddingLeft: 18, margin: "0 0 14px 0" },
  li: { margin: "0 0 8px 0", lineHeight: 1.6 },
};
