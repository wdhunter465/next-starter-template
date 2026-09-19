export type ClubHomeStoryImage = {
  url: string;
  alt: string;
  credit_line: string | null;
  source_name: string | null;
  rendition_size: 'thumbnail' | 'small' | 'medium' | 'large';
};

export type ClubHomeStory = {
  id: number;
  title: string | null;
  headline: string | null;
  summary: string | null;
  credit: string | null;
  source_name: string | null;
  year: number | null;
  tag: string | null;
  perspective_label: string | null;
  canonical: boolean;
  story_type: string | null;
  /** Zone-sized rendition of the story's primary image, when available (#4180). */
  image: ClubHomeStoryImage | null;
};

export type ClubHomeMediaFeature = {
  thumbnail_url: string | null;
  /** Persisted rendition size label when thumbnail_url comes from a ready rendition. */
  media_rendition?: string | null;
  title: string | null;
  description: string | null;
  credit_line: string | null;
  source_name: string | null;
  href: string;
  is_memorabilia: boolean;
};

export type ClubHomeApiResponse = {
  ok: boolean;
  source?: 'content_inventory' | 'static';
  lead_story?: ClubHomeStory | null;
  rail_stories?: ClubHomeStory[];
  archive_spotlight?: ClubHomeStory | null;
  media_feature?: ClubHomeMediaFeature | null;
  error?: string;
};

export async function fetchClubHome(): Promise<ClubHomeApiResponse> {
  const res = await fetch('/api/fanclub/home', { credentials: 'include', cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as ClubHomeApiResponse;
  if (!res.ok || !data?.ok) {
    return { ok: false, error: data?.error || 'Unable to load Club Home content.' };
  }
  return data;
}
