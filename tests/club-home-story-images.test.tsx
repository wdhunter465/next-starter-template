import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ClubHomeArchiveSpotlight from '@/components/fanclub/ClubHomeArchiveSpotlight';
import ClubHomeStaticStory from '@/components/fanclub/ClubHomeStaticStory';
import ClubHomeStoryRail from '@/components/fanclub/ClubHomeStoryRail';
import type { ClubHomeStory } from '@/lib/clubHomeApi';

// #4180: pictures route to each Club Home posting space, sized by placement —
// a large hero frame in the center, a small thumbnail in the margin zones.

describe('ClubHomeStaticStory image routing (#4180)', () => {
  it('renders a large hero image in place of the placeholder when not compact', () => {
    render(
      <ClubHomeStaticStory
        ariaLabel="Lead story"
        title="Lead Story"
        headline="Iron Horse headline"
        summary="Lead summary."
        image={{ url: 'https://cdn.example.com/hero.jpg', alt: 'Lead hero photo' }}
      />,
    );

    const img = screen.getByRole('img', { name: 'Lead hero photo' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/hero.jpg');
    expect(screen.queryByText(/Photo — Iron Horse headline/)).not.toBeInTheDocument();
  });

  it('falls back to the placeholder when not compact and no image is given', () => {
    render(
      <ClubHomeStaticStory
        ariaLabel="Lead story"
        title="Lead Story"
        headline="Iron Horse headline"
        summary="Lead summary."
      />,
    );

    expect(screen.getByText(/Photo — Iron Horse headline/)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders a small thumbnail beside the headline when compact and an image is given', () => {
    render(
      <ClubHomeStaticStory
        ariaLabel="Secondary story"
        title="Story"
        headline="Rail headline"
        summary="Rail summary."
        image={{ url: 'https://cdn.example.com/thumb.jpg', alt: 'Rail thumb photo' }}
        compact
      />,
    );

    const img = screen.getByRole('img', { name: 'Rail thumb photo' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/thumb.jpg');
  });

  it('renders no image element when compact and no image is given (no placeholder clutter in tight margin cards)', () => {
    render(
      <ClubHomeStaticStory
        ariaLabel="Secondary story"
        title="Story"
        headline="Rail headline"
        summary="Rail summary."
        compact
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('ClubHomeStoryRail image routing (#4180)', () => {
  it('passes each dynamic story image through to its compact card', () => {
    const stories: ClubHomeStory[] = [
      {
        id: 1,
        title: 'Story',
        headline: 'Rail one',
        summary: 'Summary one',
        credit: null,
        source_name: null,
        year: null,
        tag: null,
        perspective_label: null,
        canonical: true,
        story_type: 'secondary',
        image: { url: 'https://cdn.example.com/rail-1.jpg', alt: 'Rail one photo', credit_line: null, source_name: null, rendition_size: 'thumbnail' },
      },
      {
        id: 2,
        title: 'Story',
        headline: 'Rail two',
        summary: 'Summary two',
        credit: null,
        source_name: null,
        year: null,
        tag: null,
        perspective_label: null,
        canonical: true,
        story_type: 'brief',
        image: null,
      },
    ];

    render(<ClubHomeStoryRail stories={stories} />);

    const img = screen.getByRole('img', { name: 'Rail one photo' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/rail-1.jpg');
    expect(screen.getAllByRole('img')).toHaveLength(1);
  });
});

describe('ClubHomeArchiveSpotlight image routing (#4180)', () => {
  it('renders a thumbnail beside the spotlight headline when the story has an image', () => {
    const story: ClubHomeStory = {
      id: 4,
      title: 'Spotlight',
      headline: 'Spotlight headline',
      summary: 'Spotlight summary',
      credit: null,
      source_name: null,
      year: null,
      tag: null,
      perspective_label: null,
      canonical: true,
      story_type: 'primary',
      image: {
        url: 'https://cdn.example.com/spotlight.jpg',
        alt: 'Spotlight photo',
        credit_line: null,
        source_name: null,
        rendition_size: 'thumbnail',
      },
    };

    render(<ClubHomeArchiveSpotlight story={story} />);

    const img = screen.getByRole('img', { name: 'Spotlight photo' });
    expect(img).toHaveAttribute('src', 'https://cdn.example.com/spotlight.jpg');
  });

  it('renders no image element when the spotlight story has none', () => {
    const story: ClubHomeStory = {
      id: 4,
      title: 'Spotlight',
      headline: 'Spotlight headline',
      summary: 'Spotlight summary',
      credit: null,
      source_name: null,
      year: null,
      tag: null,
      perspective_label: null,
      canonical: true,
      story_type: 'primary',
      image: null,
    };

    render(<ClubHomeArchiveSpotlight story={story} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
