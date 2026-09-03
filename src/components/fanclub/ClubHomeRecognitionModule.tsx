'use client';

import { useEffect, useState } from 'react';
import { clubHomeMutedText, clubHomeSectionCard, clubHomeSectionTitle } from './clubHomeStyles';

type Friend = {
  id: number;
  name: string;
  kind?: string;
  blurb?: string | null;
  url?: string | null;
};

export default function ClubHomeRecognitionModule() {
  const [friends, setFriends] = useState<Friend[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/friends/list?limit=4', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setFriends(res.ok && data?.ok && Array.isArray(data.items) ? data.items : []);
      } catch {
        if (!cancelled) setFriends([]);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasFriends = Boolean(friends && friends.length > 0);

  return (
    <section aria-label="Recognition & Partners" style={clubHomeSectionCard}>
      <h2 style={clubHomeSectionTitle}>Recognition & Partners</h2>
      {hasFriends ? (
        <ul style={{ margin: '0 0 12px 0', padding: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
          {friends!.map((friend) => (
            <li key={friend.id}>
              {friend.url ? (
                <a href={friend.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={{ fontWeight: 700 }}>
                  {friend.name}
                </a>
              ) : (
                <div style={{ fontWeight: 700 }}>{friend.name}</div>
              )}
              {friend.blurb ? <div style={clubHomeMutedText}>{friend.blurb}</div> : null}
            </li>
          ))}
        </ul>
      ) : friends !== null ? (
        <p style={{ ...clubHomeMutedText, marginBottom: 12 }}>
          Partner and recognition highlights will appear here once posted.
        </p>
      ) : null}
    </section>
  );
}
