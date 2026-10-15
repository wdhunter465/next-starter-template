import Link from 'next/link';
import styles from './not-found.module.css';

export default function NotFound() {
	return (
		<main className={styles.page}>
			<h1 className={styles.code}>404</h1>
			<h2 className={styles.title}>Page Not Found</h2>
			<p className={styles.copy}>Sorry, we couldn&apos;t find the page you&apos;re looking for.</p>
			<Link className={styles.home} href="/">
				Return Home
			</Link>
		</main>
	);
}
