'use client';

import { useState } from 'react';
import { useMemberSession } from '@/hooks/useMemberSession';

type RightsChoice = 'member_owns_full_grant' | 'external_source_needs_evaluation' | '';

const inputStyle: React.CSSProperties = {
  padding: 10,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(0,0,0,0.2)',
};

const sectionStyle: React.CSSProperties = {
  marginTop: 14,
  padding: 16,
  borderRadius: 16,
  border: '1px solid rgba(255,255,255,0.14)',
};

function RightsChoiceFields({
  rightsChoice,
  setRightsChoice,
  sourceUrl,
  setSourceUrl,
  idPrefix,
}: {
  rightsChoice: RightsChoice;
  setRightsChoice: (value: RightsChoice) => void;
  sourceUrl: string;
  setSourceUrl: (value: string) => void;
  idPrefix: string;
}) {
  return (
    <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 15 }}>Rights and permission</h3>
      <p style={{ margin: '0 0 10px 0', fontSize: 13, opacity: 0.8 }}>
        Pick one. We need this before we can review your submission.
      </p>

      {/* Mutually exclusive by nature -- a radio group (not independently
          toggleable checkboxes) is the correct, accessible control: screen
          readers announce it as a single choice and arrow-key navigation
          works as expected. */}
      <div role="radiogroup" aria-label="Rights and permission">
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, cursor: 'pointer' }}>
          <input
            type="radio"
            name={`${idPrefix}-rights-choice`}
            checked={rightsChoice === 'member_owns_full_grant'}
            onChange={() => setRightsChoice('member_owns_full_grant')}
            style={{ marginTop: 3 }}
          />
          <span>
            This was created by me, or shows my personal collection. I grant full permission for the Lou Gehrig Fan
            Club to use it on the website.
          </span>
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input
            type="radio"
            name={`${idPrefix}-rights-choice`}
            checked={rightsChoice === 'external_source_needs_evaluation'}
            onChange={() => setRightsChoice('external_source_needs_evaluation')}
            style={{ marginTop: 3 }}
          />
          <span>I don&apos;t own this &mdash; I found it elsewhere. Provide the source URL below for copyright review.</span>
        </label>
      </div>

      {rightsChoice === 'external_source_needs_evaluation' && (
        <input
          id={`${idPrefix}-source-url`}
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Source URL (where you found this)"
          style={{ ...inputStyle, marginTop: 10, width: '100%' }}
        />
      )}
    </div>
  );
}

function TagFields({
  peopleTags,
  setPeopleTags,
  topicTags,
  setTopicTags,
}: {
  peopleTags: string;
  setPeopleTags: (value: string) => void;
  topicTags: string;
  setTopicTags: (value: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 4 }}>
      <input
        value={peopleTags}
        onChange={(e) => setPeopleTags(e.target.value)}
        placeholder="People tags, comma separated (e.g. Lou Gehrig, Babe Ruth)"
        style={inputStyle}
      />
      <input
        value={topicTags}
        onChange={(e) => setTopicTags(e.target.value)}
        placeholder="Topic tags, comma separated (e.g. 1938 season, Yankee Stadium)"
        style={inputStyle}
      />
    </div>
  );
}

export default function FanclubSubmitPage() {
  const { isLoading, isAuthenticated, email } = useMemberSession({ redirectTo: '/' });

  // Article state
  const [articleName, setArticleName] = useState('');
  const [articleTitle, setArticleTitle] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleRightsChoice, setArticleRightsChoice] = useState<RightsChoice>('');
  const [articleSourceUrl, setArticleSourceUrl] = useState('');
  const [articleCreditPreference, setArticleCreditPreference] = useState('');
  const [articlePeopleTags, setArticlePeopleTags] = useState('');
  const [articleTopicTags, setArticleTopicTags] = useState('');
  const [articleBusy, setArticleBusy] = useState(false);
  const [articleMsg, setArticleMsg] = useState('');

  // Photo state
  const [photoName, setPhotoName] = useState('');
  const [photoCaption, setPhotoCaption] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRightsChoice, setPhotoRightsChoice] = useState<RightsChoice>('');
  const [photoSourceUrl, setPhotoSourceUrl] = useState('');
  const [photoCreditPreference, setPhotoCreditPreference] = useState('');
  const [photoPeopleTags, setPhotoPeopleTags] = useState('');
  const [photoTopicTags, setPhotoTopicTags] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState('');

  function splitTags(value: string): string[] {
    return value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  async function submitArticle() {
    setArticleMsg('');
    setArticleBusy(true);
    try {
      const res = await fetch('/api/library/content-pipeline/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submitter_name: articleName.trim(),
          title: articleTitle.trim(),
          summary: articleContent.trim(),
          submission_type: 'story',
          rights_choice: articleRightsChoice,
          source_url: articleRightsChoice === 'external_source_needs_evaluation' ? articleSourceUrl.trim() : undefined,
          credit_preference: articleCreditPreference,
          people_tags: splitTags(articlePeopleTags),
          topic_tags: splitTags(articleTopicTags),
        }),
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'submit_failed');
      setArticleTitle('');
      setArticleContent('');
      setArticleRightsChoice('');
      setArticleSourceUrl('');
      setArticleCreditPreference('');
      setArticlePeopleTags('');
      setArticleTopicTags('');
      setArticleMsg(json.message || 'Submitted. Thank you!');
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : String(e);
      setArticleMsg(`Error: ${text}`);
    } finally {
      setArticleBusy(false);
    }
  }

  async function submitPhoto() {
    setPhotoMsg('');
    setPhotoBusy(true);
    try {
      if (!photoFile) throw new Error('A photo file is required.');
      const form = new FormData();
      form.set('file', photoFile);
      form.set('submitter_name', photoName.trim());
      form.set('credit_preference', photoCreditPreference);
      form.set('rights_choice', photoRightsChoice);
      if (photoRightsChoice === 'external_source_needs_evaluation') {
        form.set('source_url', photoSourceUrl.trim());
      }
      if (photoCaption.trim()) form.set('caption', photoCaption.trim());
      if (photoPeopleTags.trim()) form.set('people_tags', photoPeopleTags.trim());
      if (photoTopicTags.trim()) form.set('topic_tags', photoTopicTags.trim());

      const res = await fetch('/api/fanclub/photos/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'submit_failed');
      setPhotoFile(null);
      setPhotoCaption('');
      setPhotoRightsChoice('');
      setPhotoSourceUrl('');
      setPhotoCreditPreference('');
      setPhotoPeopleTags('');
      setPhotoTopicTags('');
      setPhotoMsg(json.message || 'Submitted. Thank you!');
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : String(e);
      setPhotoMsg(`Error: ${text}`);
    } finally {
      setPhotoBusy(false);
    }
  }

  const canSubmitArticle =
    !articleBusy &&
    articleName.trim().length >= 2 &&
    email.trim().length >= 5 &&
    articleTitle.trim().length >= 3 &&
    articleContent.trim().length >= 20 &&
    articleCreditPreference.length > 0 &&
    (articleRightsChoice === 'member_owns_full_grant' ||
      (articleRightsChoice === 'external_source_needs_evaluation' && articleSourceUrl.trim().length > 0));

  const canSubmitPhoto =
    !photoBusy &&
    photoName.trim().length >= 2 &&
    email.trim().length >= 5 &&
    !!photoFile &&
    photoCreditPreference.length > 0 &&
    (photoRightsChoice === 'member_owns_full_grant' ||
      (photoRightsChoice === 'external_source_needs_evaluation' && photoSourceUrl.trim().length > 0));

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 16px' }}>
      <h1 style={{ fontSize: 32, margin: '0 0 8px 0' }}>Member Submissions</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Submit a short article or a photo to be considered for the site. Rights and permission are captured with two
        simple checkboxes below &mdash; pick the one that applies.
      </p>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Submit an article</h2>

        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <input
            value={articleName}
            onChange={(e) => setArticleName(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
          <input value={email} readOnly placeholder="Your email" style={{ ...inputStyle, background: 'rgba(0,0,0,0.12)' }} />
          <input
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            placeholder="Article title"
            style={inputStyle}
          />
          <textarea
            value={articleContent}
            onChange={(e) => setArticleContent(e.target.value)}
            placeholder="Paste your article text here…"
            rows={8}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          <TagFields
            peopleTags={articlePeopleTags}
            setPeopleTags={setArticlePeopleTags}
            topicTags={articleTopicTags}
            setTopicTags={setArticleTopicTags}
          />

          <RightsChoiceFields
            rightsChoice={articleRightsChoice}
            setRightsChoice={setArticleRightsChoice}
            sourceUrl={articleSourceUrl}
            setSourceUrl={setArticleSourceUrl}
            idPrefix="article"
          />

          <label style={{ display: 'grid', gap: 6 }}>
            How should we credit you?
            <select
              value={articleCreditPreference}
              onChange={(e) => setArticleCreditPreference(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select a credit preference…</option>
              <option value="public_credit">Credit me by name</option>
              <option value="anonymous">Credit as anonymous</option>
              <option value="private">Do not display my name publicly</option>
              <option value="custom">Other (note in your submission text)</option>
            </select>
          </label>

          <button
            onClick={submitArticle}
            disabled={!canSubmitArticle}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: canSubmitArticle ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
              cursor: canSubmitArticle ? 'pointer' : 'not-allowed',
            }}
          >
            {articleBusy ? 'Submitting…' : 'Submit article'}
          </button>
          {articleMsg && <div style={{ marginTop: 6, opacity: 0.9 }}>{articleMsg}</div>}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Submit a photo</h2>

        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <input
            value={photoName}
            onChange={(e) => setPhotoName(e.target.value)}
            placeholder="Your name"
            style={inputStyle}
          />
          <input value={email} readOnly placeholder="Your email" style={{ ...inputStyle, background: 'rgba(0,0,0,0.12)' }} />
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/tiff"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
            style={inputStyle}
          />
          <input
            value={photoCaption}
            onChange={(e) => setPhotoCaption(e.target.value)}
            placeholder="Caption (optional)"
            style={inputStyle}
          />

          <TagFields
            peopleTags={photoPeopleTags}
            setPeopleTags={setPhotoPeopleTags}
            topicTags={photoTopicTags}
            setTopicTags={setPhotoTopicTags}
          />

          <RightsChoiceFields
            rightsChoice={photoRightsChoice}
            setRightsChoice={setPhotoRightsChoice}
            sourceUrl={photoSourceUrl}
            setSourceUrl={setPhotoSourceUrl}
            idPrefix="photo"
          />

          <label style={{ display: 'grid', gap: 6 }}>
            How should we credit you?
            <select
              value={photoCreditPreference}
              onChange={(e) => setPhotoCreditPreference(e.target.value)}
              style={inputStyle}
            >
              <option value="">Select a credit preference…</option>
              <option value="public_credit">Credit me by name</option>
              <option value="anonymous">Credit as anonymous</option>
              <option value="private">Do not display my name publicly</option>
              <option value="custom">Other (note in your caption)</option>
            </select>
          </label>

          <button
            onClick={submitPhoto}
            disabled={!canSubmitPhoto}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: canSubmitPhoto ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
              cursor: canSubmitPhoto ? 'pointer' : 'not-allowed',
            }}
          >
            {photoBusy ? 'Submitting…' : 'Submit photo'}
          </button>
          {photoMsg && <div style={{ marginTop: 6, opacity: 0.9 }}>{photoMsg}</div>}
        </div>
      </section>
    </main>
  );
}
