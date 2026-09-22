'use client';

import { useEffect, useState } from 'react';
import { fetchGehrigRandomGame, type GehrigRandomGame } from '@/lib/gehrigBoxScoreApi';

export type GehrigGameLoadState = {
  status: 'loading' | 'ready' | 'empty';
  game: GehrigRandomGame | null;
};

export function useGehrigRandomGame(): GehrigGameLoadState {
  const [state, setState] = useState<GehrigGameLoadState>({ status: 'loading', game: null });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchGehrigRandomGame();
        if (cancelled) return;
        if (data.ok && data.game) {
          setState({ status: 'ready', game: data.game });
          return;
        }
        setState({ status: 'empty', game: null });
      } catch {
        if (!cancelled) setState({ status: 'empty', game: null });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
