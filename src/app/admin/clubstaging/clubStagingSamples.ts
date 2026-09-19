import type { ClubHomeStory } from '@/lib/clubHomeApi';

export type ClubStagingRotationItem = {
  id: string;
  title: string;
  headline: string;
  summary: string;
  credit?: string;
  sourceName?: string;
};

export const CLUB_STAGING_BOUNDARY_COPY =
  'Staging preview only. Sample club content shown here is not published on public or member routes.';

export const CLUB_STAGING_ROTATION_ITEMS: ClubStagingRotationItem[] = [
  {
    id: 'rotation-lou-day-2027',
    title: 'Featured rotation',
    headline: 'Lou Gehrig Day community spotlight (sample)',
    summary:
      'Preview how a featured club story could appear on Club Home before the 2027 relaunch. This card rotates through staged samples only.',
    credit: 'LGFC staging sample',
    sourceName: 'Club editorial draft',
  },
  {
    id: 'rotation-archive-photo',
    title: 'Featured rotation',
    headline: 'Archive photo of the week (sample)',
    summary:
      'Use this rotation slot to review headline length, credit lines, and source attribution before any live publication workflow.',
    credit: 'Sample archive credit',
    sourceName: 'Member submission preview',
  },
  {
    id: 'rotation-partner-note',
    title: 'Featured rotation',
    headline: 'Partner recognition note (sample)',
    summary:
      'Rotation previews help operators compare alternate club stories without exposing staged copy on public pages.',
    credit: 'LGFC staging sample',
    sourceName: 'Partner draft',
  },
];

export const CLUB_STAGING_RAIL_STORIES: ClubHomeStory[] = [
  {
    id: 9001,
    title: 'Story',
    headline: 'Yankee Stadium clubhouse memory (staged)',
    summary: 'Secondary rail card using production Club Home layout for visual review.',
    credit: 'Staging sample',
    source_name: 'Editorial queue',
    year: null,
    tag: null,
    perspective_label: null,
    canonical: false,
    story_type: 'staging_sample',
    image: null,
  },
  {
    id: 9002,
    title: 'Story',
    headline: 'ALS awareness community note (staged)',
    summary: 'Sample rail item for spacing, typography, and non-public staging labels.',
    credit: 'Staging sample',
    source_name: 'Club communications',
    year: null,
    tag: null,
    perspective_label: null,
    canonical: false,
    story_type: 'staging_sample',
    image: null,
  },
];

export const CLUB_STAGING_DISCUSSION_SAMPLES = [
  {
    id: 'discussion-sample-1',
    title: 'What should first-time members see on Club Home?',
    body: 'Staged discussion preview for moderator review before any member-visible post goes live.',
    created_at: '2026-06-01',
  },
  {
    id: 'discussion-sample-2',
    title: 'Archive photo caption style check',
    body: 'Sample club post card for layout review. Not published to member discussions.',
    created_at: '2026-06-15',
  },
] as const;
