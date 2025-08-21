import { create } from 'zustand';
import type { LeaderboardRow } from '../domain/types';

type Phase = 'idle' | 'question' | 'scoreboard' | 'finished';

type LiveState = {
  phase: Phase;
  index: number;
  top: LeaderboardRow[];
  bins: { option: number; count: number }[];
  set: (patch: Partial<LiveState>) => void;
  reset: () => void;
};

export const useLive = create<LiveState>((set) => ({
  phase: 'idle',
  index: 0,
  top: [],
  bins: [],
  set: (patch) => set(patch),
  reset: () => set({ phase: 'idle', index: 0, top: [], bins: [] }),
}));
