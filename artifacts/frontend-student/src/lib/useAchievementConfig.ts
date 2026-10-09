// The achievement targets + rank steps an admin has configured (Settings →
// Access). Same ['site-content'] query the shell already runs, so this costs
// no extra request; until it loads (or if the setting is blank/invalid) the
// shipped defaults apply.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { siteContentApi } from '@/lib/api';
import { parseAchievementConfig, type AchievementConfig } from '@/lib/progressAchievements';

export function useAchievementConfig(): AchievementConfig {
  const q = useQuery({ queryKey: ['site-content'], queryFn: siteContentApi.get, staleTime: 5 * 60_000 });
  const raw = q.data?.ACHIEVEMENT_CONFIG;
  return useMemo(() => parseAchievementConfig(raw), [raw]);
}
