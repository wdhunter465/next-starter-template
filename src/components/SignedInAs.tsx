import styles from './SignedInAs.module.css';

// #5122: tells a signed-in visitor which account they are signed in as. Shows nothing without an email.
export default function SignedInAs({ email }: { email?: string | null }) {
  const address = typeof email === 'string' ? email.trim() : '';
  if (!address) return null;
  return (
    <div className={styles.bar} data-testid="signed-in-as">
      Signed in as <strong>{address}</strong>
    </div>
  );
}
