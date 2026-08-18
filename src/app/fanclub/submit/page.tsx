'use client';

import { useState } from 'react';
import { useMemberSession } from '@/hooks/useMemberSession';

type RightsChoice = 'member_owns_full_grant' | 'external_source_needs_evaluation' | '';
type SubmissionKind = 'article' | 'photo';

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
}: {
  rightsChoice: RightsChoice;
  setRightsChoice: (value: RightsChoice) => void;
  sourceUrl: string;
  setSourceUrl: (value: string) => void;
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
            name="rights-choice"
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
            name="rights-choice"
            checked={rightsChoice === 'external_source_needs_evaluation'}
            onChange={() => setRightsChoice('external_source_needs_evaluation')}
            style={{ marginTop: 3 }}
          />
          <span>I don&apos;t own this &mdash; I found it elsewhere. Provide the source URL below for copyright review.</span>
        </label>
      </div>

      {rightsChoice === 'external_source_needs_evaluation' && (
        <input
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
  kind,
  peopleTags,
  setPeopleTags,
  topicTags,
  setTopicTags,
}: {
  kind: SubmissionKind;
  peopleTags: string;
  setPeopleTags: (value: string) => void;
  topicTags: string;
  setTopicTags: (value: string) => void;
}) {
  return (
    <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: 15 }}>Tags</h3>
      <p style={{ margin: '0 0 10px 0', fontSize: 13, opacity: 0.8 }}>
        Tags help find this {kind} in the Fan Club&apos;s database.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
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
    </div>
  );
}

export default function FanclubSubmitPage() {
  const { isLoading, isAuthenticated, email } = useMemberSession({ redirectTo: '/' });

  const [kind, setKind] = useState<SubmissionKind>('article');

  // Shared fields
  const [name, setName] = useState('');
  const [rightsChoice, setRightsChoice] = useState<RightsChoice>('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [creditPreference, setCreditPreference] = useState('');
  const [peopleTags, setPeopleTags] = useState('');
  const [topicTags, setTopicTags] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Article-only fields
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  // Photo-only fields
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);

  function splitTags(value: string): string[] {
    return value
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  function resetSharedFields() {
    setRightsChoice('');
    setSourceUrl('');
    setCreditPreference('');
    setPeopleTags('');
    setTopicTags('');
  }

  function switchKind(next: SubmissionKind) {
    setKind(next);
    setMsg('');
  }

  async function submitArticle() {
    const res = await fetch('/api/library/content-pipeline/submit', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submitter_name: name.trim(),
        title: title.trim(),
        summary: content.trim(),
        submission_type: 'story',
        rights_choice: rightsChoice,
        source_url: rightsChoice === 'external_source_needs_evaluation' ? sourceUrl.trim() : undefined,
        credit_preference: creditPreference,
        people_tags: splitTags(peopleTags),
        topic_tags: splitTags(topicTags),
      }),
    });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error || 'submit_failed');
    setTitle('');
    setContent('');
    return json.message || 'Submitted. Thank you!';
  }

  async function submitPhoto() {
    if (!file) throw new Error('A photo file is required.');
    const form = new FormData();
    form.set('file', file);
    form.set('submitter_name', name.trim());
    form.set('credit_preference', creditPreference);
    form.set('rights_choice', rightsChoice);
    if (rightsChoice === 'external_source_needs_evaluation') {
      form.set('source_url', sourceUrl.trim());
    }
    if (caption.trim()) form.set('caption', caption.trim());
    if (peopleTags.trim()) form.set('people_tags', peopleTags.trim());
    if (topicTags.trim()) form.set('topic_tags', topicTags.trim());

    const res = await fetch('/api/fanclub/photos/upload', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error || 'submit_failed');
    setFile(null);
    setCaption('');
    return json.message || 'Submitted. Thank you!';
  }

  async function submit() {
    setMsg('');
    setBusy(true);
    try {
      const successMessage = kind === 'article' ? await submitArticle() : await submitPhoto();
      resetSharedFields();
      setMsg(successMessage);
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : String(e);
      setMsg(`Error: ${text}`);
    } finally {
      setBusy(false);
    }
  }

  const rightsSatisfied =
    rightsChoice === 'member_owns_full_grant' ||
    (rightsChoice === 'external_source_needs_evaluation' && sourceUrl.trim().length > 0);

  const canSubmit =
    !busy &&
    name.trim().length >= 2 &&
    email.trim().length >= 5 &&
    creditPreference.length > 0 &&
    rightsSatisfied &&
    (kind === 'article'
      ? title.trim().length >= 3 && content.trim().length >= 20
      : !!file);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 16px' }}>
      <h1 style={{ fontSize: 32, margin: '0 0 8px 0' }}>Member Submissions</h1>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Submit a short article or a photo to be considered for the site. Rights and permission are captured with a
        simple choice below &mdash; pick the one that applies.
      </p>

      <section style={sectionStyle}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Submit to the Fan Club</h2>

        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          <div role="radiogroup" aria-label="What are you submitting?" style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="submission-kind" checked={kind === 'article'} onChange={() => switchKind('article')} />
              Article
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="radio" name="submission-kind" checked={kind === 'photo'} onChange={() => switchKind('photo')} />
              Photo
            </label>
          </div>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inputStyle} />
          <input value={email} readOnly placeholder="Your email" style={{ ...inputStyle, background: 'rgba(0,0,0,0.12)' }} />

          {kind === 'article' ? (
            <div key="article-fields" style={{ display: 'grid', gap: 10 }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
                style={inputStyle}
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Paste your article text here…"
                rows={8}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>
          ) : (
            <div key="photo-fields" style={{ display: 'grid', gap: 10 }}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,image/tiff"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={inputStyle}
              />
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption (optional)"
                style={inputStyle}
              />
            </div>
          )}

          <TagFields kind={kind} peopleTags={peopleTags} setPeopleTags={setPeopleTags} topicTags={topicTags} setTopicTags={setTopicTags} />

          <RightsChoiceFields
            rightsChoice={rightsChoice}
            setRightsChoice={setRightsChoice}
            sourceUrl={sourceUrl}
            setSourceUrl={setSourceUrl}
          />

          <label style={{ display: 'grid', gap: 6 }}>
            How should we credit you?
            <select value={creditPreference} onChange={(e) => setCreditPreference(e.target.value)} style={inputStyle}>
              <option value="">Select a credit preference…</option>
              <option value="public_credit">Credit me by name</option>
              <option value="anonymous">Credit as anonymous</option>
              <option value="private">Do not display my name publicly</option>
              <option value="custom">Other (note in your {kind === 'article' ? 'submission text' : 'caption'})</option>
            </select>
          </label>

          <button
            onClick={submit}
            disabled={!canSubmit}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.18)',
              background: canSubmit ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? 'Submitting…' : kind === 'article' ? 'Submit article' : 'Submit photo'}
          </button>
          {msg && <div style={{ marginTop: 6, opacity: 0.9 }}>{msg}</div>}
        </div>
      </section>
    </main>
  );
}
