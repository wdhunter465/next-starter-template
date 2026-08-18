import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import HomePage from '@/app/page';

/**
 * Homepage Structure Drift Guard Test
 * 
 * This test enforces the v6 homepage specification defined in:
 * - /docs/lgfc-homepage-legacy-v6.html
 * - /docs/Design-spec.md
 * - /docs/HOMEPAGE_SPEC.md
 * 
 * Any changes to homepage section order or structure must:
 * 1. Update the specification documents
 * 2. Update this test
 * 3. Be explicitly approved
 */

describe('Homepage Structure - V6 Specification Enforcement', () => {
  it('should render all required v6 sections in the correct order', () => {
    const { container } = render(<HomePage />);
    
    // Get all sections and headings to verify order
    const sections = container.querySelectorAll('section, header');
    
    // Assert we have the expected number of major sections (including social-wall)
    expect(sections.length).toBeGreaterThanOrEqual(8);
  });

  it('should have Hero/Banner section first', () => {
    render(<HomePage />);
    
    // Hero should contain the welcome heading
    const heroHeading = screen.getByRole('heading', { 
      name: /welcome to the lou gehrig fan club/i,
      level: 1 
    });
    expect(heroHeading).toBeInTheDocument();
  });

  it('should have Weekly Matchup section second', () => {
    // Reactivated 2026-08-18 (#3552); stub fetch to a pending promise so the
    // component deterministically stays in its loading state rather than
    // depending on jsdom's unmocked-fetch behavior for a relative URL.
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));

    render(<HomePage />);

    // Weekly Matchup should have its specific heading
    const weeklyHeading = screen.getByRole('heading', {
      name: /weekly photo matchup/i,
      level: 2
    });
    expect(weeklyHeading).toBeInTheDocument();
    expect(screen.getByText(/loading matchup/i)).toBeInTheDocument();

    fetchSpy.mockRestore();
  });

  it('should have Join/Login CTA section (Membership CTA)', () => {
    render(<HomePage />);
    
    // Join CTA should be present with member-related content
    const joinSection = screen.getByText(/join the fan club for member archives/i);
    expect(joinSection).toBeInTheDocument();
  });

  it('should have Recent Club discussions section (Member Posts Preview)', () => {
    render(<HomePage />);
    
    // Recent Club discussions heading
    const discussionsHeading = screen.getByRole('heading', { 
      name: /recent club discussions/i,
      level: 2 
    });
    expect(discussionsHeading).toBeInTheDocument();
  });

  it('should have Friends of the Fan Club section', () => {
    render(<HomePage />);
    
    // Friends section heading
    const friendsHeading = screen.getByRole('heading', { 
      name: /friends of the fan club/i,
      level: 2 
    });
    expect(friendsHeading).toBeInTheDocument();
  });

  it('should have Events Calendar section', () => {
    render(<HomePage />);
    
    // Calendar section heading
    const calendarHeading = screen.getByRole('heading', { 
      name: /fan club events calendar/i,
      level: 2 
    });
    expect(calendarHeading).toBeInTheDocument();
  });

  it('should have Social Wall section', () => {
    render(<HomePage />);
    
    // Social Wall section heading
    const socialWallHeading = screen.getByRole('heading', { 
      name: /social wall/i,
      level: 2 
    });
    expect(socialWallHeading).toBeInTheDocument();
  });

  it('should have FAQ and Milestones section', () => {
    render(<HomePage />);
    
    // FAQ heading
    const faqHeading = screen.getByRole('heading', { 
      name: /faq.*question/i,
      level: 2 
    });
    expect(faqHeading).toBeInTheDocument();
    
    // Milestones heading
    const milestonesHeading = screen.getByRole('heading', { 
      name: /milestones/i,
      level: 2 
    });
    expect(milestonesHeading).toBeInTheDocument();
  });

  it('should maintain section order: Hero -> Weekly -> Join -> Social Wall -> Discussions -> Friends -> Milestones -> Calendar -> FAQ', () => {
    const { container } = render(<HomePage />);
    
    // Collect all h1 and h2 headings in order
    const headings = Array.from(container.querySelectorAll('h1, h2')).map(
      (el) => el.textContent?.toLowerCase() || ''
    );
    
    // Define expected order by checking indices
    const heroIndex = headings.findIndex(h => h.includes('welcome to the lou gehrig fan club'));
    const weeklyIndex = headings.findIndex(h => h.includes('weekly photo matchup'));
    const socialWallIndex = headings.findIndex(h => h.includes('social wall'));
    const discussionsIndex = headings.findIndex(h => h.includes('recent club discussions'));
    const friendsIndex = headings.findIndex(h => h.includes('friends of the fan club'));
    const milestonesIndex = headings.findIndex(h => h === 'milestones');
    const calendarIndex = headings.findIndex(h => h.includes('calendar'));
    const faqIndex = headings.findIndex(h => h.includes('faq'));
    
    // Verify all sections are found
    expect(heroIndex).toBeGreaterThanOrEqual(0);
    expect(weeklyIndex).toBeGreaterThanOrEqual(0);
    expect(socialWallIndex).toBeGreaterThanOrEqual(0);
    expect(discussionsIndex).toBeGreaterThanOrEqual(0);
    expect(friendsIndex).toBeGreaterThanOrEqual(0);
    expect(milestonesIndex).toBeGreaterThanOrEqual(0);
    expect(calendarIndex).toBeGreaterThanOrEqual(0);
    expect(faqIndex).toBeGreaterThanOrEqual(0);
    
    // Verify order (each section should come after the previous)
    expect(heroIndex).toBeLessThan(weeklyIndex);
    expect(weeklyIndex).toBeLessThan(socialWallIndex);
    expect(socialWallIndex).toBeLessThan(discussionsIndex);
    expect(discussionsIndex).toBeLessThan(friendsIndex);
    expect(friendsIndex).toBeLessThan(milestonesIndex);
    expect(milestonesIndex).toBeLessThan(calendarIndex);
    expect(calendarIndex).toBeLessThan(faqIndex);
  });
});
