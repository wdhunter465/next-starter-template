'use client';

import { useEffect, useState } from 'react';
import { getStoredAdminToken, setStoredAdminToken } from '@/lib/adminClient';
import styles from './AdminDashboard.module.css';

type AdminTokenPanelProps = {
  onSaved?: () => void;
};

export default function AdminTokenPanel({ onSaved }: AdminTokenPanelProps) {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setToken(getStoredAdminToken());
  }, []);

  function saveToken() {
    setStoredAdminToken(token);
    setMessage(token.trim() ? 'Admin token saved for this browser.' : 'Admin token cleared.');
    onSaved?.();
  }

  return (
    <section className={styles.tokenCard} aria-label="Admin API token">
      <div className={styles.tokenRow}>
        <label className={styles.tokenLabel} htmlFor="admin-token">
          Admin token
        </label>
        <input
          id="admin-token"
          className={styles.tokenInput}
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Paste admin API token"
          autoComplete="off"
        />
        <button className={styles.tokenBtn} type="button" onClick={saveToken}>
          Save token
        </button>
      </div>
      <p className={styles.tokenHelp}>
        Signing in with an admin account is enough to use the admin pages. This token is only needed for
        scripts and automation that don&apos;t have a browser session &mdash; you can leave it blank.
      </p>
      {message ? <p className={styles.tokenHelp}>{message}</p> : null}
    </section>
  );
}
