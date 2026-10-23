'use client';

import { FormEvent, useState } from 'react';
import { apiPost } from '@/lib/api';

type PostCreationProps = {
  email: string;
  onPostCreated: () => void;
};

export default function PostCreation({ email, onPostCreated }: PostCreationProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError('Title and message are required.');
      return;
    }

    setSubmitting(true);
    try {
      await apiPost<{ ok: boolean }>('/api/discussions/create', {
        title: trimmedTitle,
        body: trimmedBody,
      });
      setTitle('');
      setBody('');
      setSuccess('Discussion posted.');
      onPostCreated();
    } catch {
      setError('Unable to post discussion right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      aria-label="Post creation"
      style={{
        padding: 16,
        border: '1px solid rgba(0,0,0,0.12)',
        borderRadius: 12,
        background: 'var(--lgfc-bg-card)',
      }}
    >
      <h2 style={{ margin: '0 0 8px 0' }}>Share with the Club</h2>
      <p style={{ margin: '0 0 12px 0', color: 'rgba(0,0,0,0.72)' }}>
        Posting as <strong>{email || 'member'}</strong>
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={submitting}
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>Message</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={4000}
            disabled={submitting}
            style={{ padding: 10, borderRadius: 8, border: '1px solid rgba(0,0,0,0.2)' }}
          />
        </label>
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: 'fit-content',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid rgba(0,0,0,0.2)',
            background: 'var(--lgfc-blue)',
            color: 'var(--lgfc-bg-card)',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Posting…' : 'Post Discussion'}
        </button>
      </form>

      {error ? <p style={{ margin: '12px 0 0', color: 'var(--lgfc-error)' }}>{error}</p> : null}
      {success ? <p style={{ margin: '12px 0 0', color: 'rgba(0,0,0,0.72)' }}>{success}</p> : null}
    </section>
  );
}
