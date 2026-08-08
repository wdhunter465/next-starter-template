-- 0045_privacy_join_ask_disclosure.sql
-- Purpose: Align live/seeded /privacy CMS copy with Join + Ask member-verification disclosure (#3149).
-- Idempotent: updates only when legacy under-disclosure seed copy is still present.
-- Does not authorize Production mutation by itself; apply through normal migration path.

UPDATE page_content
SET content = '<p>This is a fan-run site. We collect the minimum information needed to operate Join/Login, Ask a Question, member verification, and content submissions.</p>'
WHERE slug = '/privacy'
  AND section = 'lead_html'
  AND (
    content IS NULL
    OR content LIKE '%operate the Join list%'
    OR length(trim(content)) = 0
  );

UPDATE page_content
SET content = '<h2>What we collect</h2><ul><li>Join / Login: first name, last name, optional screen name, email address, and optional email opt-in for updates.</li><li>Ask a Question: first name, last name, optional screen name, email address, and the question text you submit for moderator review.</li><li>Member creation and verification: when you Join or Ask with a new email, we may create a member record and send a welcome or transactional confirmation email related to that request.</li><li>Session authentication: a short-lived session cookie used to keep you signed in to Fan Club member surfaces after Login.</li><li>Library submissions: the content you submit, your provided name/email, and timestamps.</li><li>Photo submissions (when enabled): the media URL, description/caption text you provide, and timestamps.</li><li>Basic technical logs (for example request timing/errors) used for reliability, security, and rate limiting.</li></ul><h2>How we use it</h2><ul><li>To operate Join/Login and member access, including session cookies for authenticated Fan Club pages.</li><li>To review and reply to Ask questions, and to add approved answers to the public FAQ when appropriate.</li><li>To send email updates only when you explicitly opt in via Join (non-opted-in members may still receive strictly transactional confirmations related to their request).</li><li>To publish and manage user submissions (Library and photo/media captions).</li><li>To keep the site secure and functioning (rate limiting, troubleshooting).</li></ul><h2>What we do not do</h2><p>We do not sell personal information.</p><h2>Removal requests</h2><p>To request removal of your email or a submission, contact: <strong>admin@lougehrigfanclub.com</strong>.</p><p>This policy will be refined as features expand. When we add new data collection, we will update this page.</p>'
WHERE slug = '/privacy'
  AND section = 'body_html'
  AND (
    content LIKE '%Join requests store name and email%'
    OR content LIKE '%Join form: name and email address%'
    OR content LIKE '%send a welcome message and updates%'
  );

-- Ensure lead_html row exists for environments that only seeded title/body.
INSERT OR IGNORE INTO page_content (slug, section, status, content, asset_url)
VALUES (
  '/privacy',
  'lead_html',
  'live',
  '<p>This is a fan-run site. We collect the minimum information needed to operate Join/Login, Ask a Question, member verification, and content submissions.</p>',
  NULL
);
