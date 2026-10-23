import Link from 'next/link';

const FEATURE_LINKS = [
  {
    href: '/fanclub/photo',
    title: 'Gallery',
    description: 'Browse approved fan club photos and visual highlights.',
  },
  {
    href: '/fanclub/library',
    title: 'Library',
    description: 'Read Gehrig library stories and editorial archive entries.',
  },
  {
    href: '/fanclub/memorabilia',
    title: 'Memorabilia',
    description: 'Explore memorabilia entries curated for members.',
  },
] as const;

export default function ArchivesTiles() {
  return (
    <section aria-label="Feature link cards">
      <h2 style={{ margin: '0 0 12px 0', color: 'var(--lgfc-blue, #003366)' }}>Club Features</h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
        }}
      >
        {FEATURE_LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
              border: '1px solid rgba(0,0,0,0.12)',
              borderRadius: 12,
              padding: 14,
              background: 'var(--lgfc-bg-card)',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 700 }}>{item.title}</div>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'rgba(0,0,0,0.7)', lineHeight: 1.45 }}>
              {item.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
