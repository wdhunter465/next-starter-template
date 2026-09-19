import {
  clubHomeColors,
  clubHomeHeadlineFontFamily,
  clubHomeMutedText,
  clubHomePhotoPlaceholder,
  clubHomeSectionCard,
  clubHomeSectionTitle,
  clubHomeStoryHeroImage,
  clubHomeStoryThumbImage,
} from './clubHomeStyles';

type ClubHomeStaticStoryImage = {
  url: string;
  alt: string;
};

type ClubHomeStaticStoryProps = {
  title: string;
  headline: string;
  summary: string;
  ariaLabel: string;
  compact?: boolean;
  credit?: string | null;
  sourceName?: string | null;
  /** Zone-sized image for this posting space — large hero framing when !compact, a small thumbnail when compact (#4180). */
  image?: ClubHomeStaticStoryImage | null;
};

/** Splits a summary into a dek (first sentence) and body, for the lead story's dual-headline treatment. */
function splitDek(summary: string): { dek: string; body: string } {
  if (!summary) return { dek: '', body: '' };
  const match = summary.match(/^(.+?[.!?])\s+([\s\S]+)$/);
  if (!match) return { dek: summary, body: '' };
  return { dek: match[1], body: match[2] };
}

export default function ClubHomeStaticStory({
  title,
  headline,
  summary,
  ariaLabel,
  compact = false,
  credit,
  sourceName,
  image,
}: ClubHomeStaticStoryProps) {
  const { dek, body } = compact ? { dek: '', body: summary } : splitDek(summary);

  const headlineBlock = (
    <>
      <h3
        style={{
          margin: '0 0 8px 0',
          fontFamily: clubHomeHeadlineFontFamily,
          fontWeight: compact ? 600 : 900,
          fontSize: compact ? 16 : 36,
          lineHeight: compact ? 1.3 : 1.08,
          color: clubHomeColors.navy,
        }}
      >
        {headline}
      </h3>
      {dek ? (
        <p
          style={{
            fontFamily: clubHomeHeadlineFontFamily,
            fontStyle: 'italic',
            fontWeight: 600,
            fontSize: 17,
            lineHeight: 1.4,
            margin: '0 0 10px 0',
            color: clubHomeColors.accent,
          }}
        >
          {dek}
        </p>
      ) : null}
      {body ? <p style={clubHomeMutedText}>{body}</p> : null}
    </>
  );

  return (
    <article aria-label={ariaLabel} style={clubHomeSectionCard}>
      <h2 style={{ ...clubHomeSectionTitle, fontSize: compact ? 12 : 13 }}>{title}</h2>
      {!compact &&
        (image ? (
          <img src={image.url} alt={image.alt} style={{ ...clubHomeStoryHeroImage, marginBottom: 14 }} />
        ) : (
          <div aria-hidden="true" style={{ ...clubHomePhotoPlaceholder(300), marginBottom: 14 }}>
            [ Photo — {headline || 'Club Home lead story'} ]
          </div>
        ))}
      {compact && image ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
          <img src={image.url} alt={image.alt} style={clubHomeStoryThumbImage()} />
          <div style={{ minWidth: 0 }}>{headlineBlock}</div>
        </div>
      ) : (
        headlineBlock
      )}
      {(credit || sourceName) && (
        <p style={{ ...clubHomeMutedText, marginTop: 8, fontSize: 12, fontStyle: 'italic' }}>
          {credit ? `Credit: ${credit}` : null}
          {credit && sourceName ? ' · ' : null}
          {sourceName ? `Source: ${sourceName}` : null}
        </p>
      )}
    </article>
  );
}
