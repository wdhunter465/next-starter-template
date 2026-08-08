'use client';

import { Suspense, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { apiPost } from '@/lib/api';
import { isValidEmail } from '@/lib/urlUtils';
import FaqBrowse from '@/components/FaqBrowse';

const SUCCESS_MESSAGE = "Your question has been submitted. We'll reply by email.";
const ERROR_MESSAGE = 'Submission failed. Please try again.';
const CONTACT_MAILTO =
  'mailto:Contact@LouGehrigFanClub.com?subject=Contact%20Needed%20ASK';

function isValidAskEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length <= 254 && isValidEmail(trimmed);
}

function AskForm() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [screenName, setScreenName] = useState('');
  const [email, setEmail] = useState('');
  const [question, setQuestion] = useState('');
  const [submitOk, setSubmitOk] = useState(false);
  const [submitErr, setSubmitErr] = useState('');
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      isValidAskEmail(email) &&
      question.trim().length >= 10
    );
  }, [firstName, lastName, email, question]);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!canSubmit || busy) return;

    setSubmitOk(false);
    setSubmitErr('');
    setBusy(true);

    try {
      const res = await apiPost<{ ok: boolean; error?: string }>('/api/ask', {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        screen_name: screenName.trim() || undefined,
        email: email.trim(),
        question: question.trim(),
      });
      if (!res.ok) throw new Error(res.error || 'submit_failed');

      setFirstName('');
      setLastName('');
      setScreenName('');
      setEmail('');
      setQuestion('');
      setSubmitOk(true);
    } catch {
      setSubmitErr(ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="ask-form" aria-labelledby="ask-form-heading" style={{ marginTop: 40 }}>
      <h2 id="ask-form-heading" style={{ fontSize: 24, margin: '0 0 10px 0' }}>
        Ask a Question
      </h2>
      <p className="sub" style={{ marginTop: 0 }}>
        Submit a question for moderator review. Approved answers may be added to the public FAQ.
        First-time email addresses may also receive a Fan Club welcome message. You can also join
        separately on <Link href="/join">Join / Login</Link>.
      </p>

      <div className="card" style={{ marginTop: 28 }}>
        <form onSubmit={submit}>
          <label htmlFor="ask-first-name">
            <strong>First name</strong>
          </label>
          <input
            id="ask-first-name"
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            required
            style={{ marginTop: 8, padding: 8, width: '100%', maxWidth: 500, display: 'block' }}
          />

          <label htmlFor="ask-last-name" style={{ marginTop: 16, display: 'block' }}>
            <strong>Last name</strong>
          </label>
          <input
            id="ask-last-name"
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            autoComplete="family-name"
            required
            style={{ marginTop: 8, padding: 8, width: '100%', maxWidth: 500, display: 'block' }}
          />

          <label htmlFor="ask-screen-name" style={{ marginTop: 16, display: 'block' }}>
            <strong>Screen name</strong> <span className="sub">(optional)</span>
          </label>
          <input
            id="ask-screen-name"
            type="text"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            autoComplete="nickname"
            style={{ marginTop: 8, padding: 8, width: '100%', maxWidth: 500, display: 'block' }}
          />

          <label htmlFor="ask-email" style={{ marginTop: 16, display: 'block' }}>
            <strong>Email</strong>
          </label>
          <input
            id="ask-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={{ marginTop: 8, padding: 8, width: '100%', maxWidth: 500, display: 'block' }}
          />

          <label htmlFor="ask-question" style={{ marginTop: 16, display: 'block' }}>
            <strong>Your question</strong>
          </label>
          <textarea
            id="ask-question"
            placeholder="Type your question (minimum 10 characters)..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={6}
            style={{
              marginTop: 8,
              padding: 8,
              width: '100%',
              maxWidth: 500,
              display: 'block',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            <button type="button" onClick={submit} disabled={!canSubmit || busy}>
              {busy ? 'Submitting…' : 'Submit'}
            </button>
          </div>

          {submitOk ? (
            <div className="success" style={{ marginTop: 20 }}>
              {SUCCESS_MESSAGE}
            </div>
          ) : null}
          {submitErr ? (
            <div className="sub" style={{ marginTop: 20, color: '#b00020' }}>
              {submitErr}
            </div>
          ) : null}

          <p className="sub" style={{ marginTop: 24 }}>
            Prefer email?{' '}
            <a href={CONTACT_MAILTO} className="link">
              Contact us directly
            </a>
          </p>
        </form>
      </div>
    </section>
  );
}

function AskPageContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';

  return (
    <>
      <h1 style={{ fontSize: 34, margin: '0 0 10px 0' }}>FAQ &amp; Ask a Question</h1>
      <p className="sub" style={{ marginTop: 0 }}>
        Browse approved FAQ answers or submit a new question for moderator review. This is the
        canonical public Ask/FAQ workflow.
      </p>

      <div style={{ marginTop: 28 }}>
        <FaqBrowse initialQuery={initialQuery} askFormHref="#ask-form" />
      </div>

      <AskForm />
    </>
  );
}

export default function AskPage() {
  return (
    <main className="container" style={{ padding: '40px 16px', maxWidth: 900, margin: '0 auto' }}>
      <Suspense
        fallback={
          <>
            <h1 style={{ fontSize: 34, margin: '0 0 10px 0' }}>FAQ &amp; Ask a Question</h1>
            <p className="sub">Loading...</p>
          </>
        }
      >
        <AskPageContent />
      </Suspense>
    </main>
  );
}
