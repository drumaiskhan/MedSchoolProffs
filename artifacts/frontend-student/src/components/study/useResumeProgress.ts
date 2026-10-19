// Looks up the student's in-progress practice sessions (saved automatically while
// practising) so topic rows / the setup screen can offer "Resume where you left off".
import { useQuery } from '@tanstack/react-query';
import { savedSessionsApi, type SavedSession, type SessionProgress } from '@/lib/api';

export interface ResumeInfo { sessionId: number; answered: number; total: number; session: SavedSession; progress: SessionProgress }

export function useResumeProgress() {
  const q = useQuery({ queryKey: ['saved-sessions'], queryFn: savedSessionsApi.list, staleTime: 30_000 });
  const byTopic = new Map<number, ResumeInfo>();
  const byPaper = new Map<number, ResumeInfo>();
  const bySession = new Map<number, ResumeInfo>();
  for (const s of q.data ?? []) {
    const c = (s.config ?? {}) as Partial<SessionProgress>;
    if (c.kind !== 'progress' || !Array.isArray(c.mcqIds)) continue;
    const answered = c.answered ?? Object.values(c.answers ?? {}).filter((v) => v != null).length;
    const info: ResumeInfo = { sessionId: s.id, answered, total: c.total ?? c.mcqIds.length, session: s, progress: c as SessionProgress };
    bySession.set(s.id, info);
    if (c.topicId) byTopic.set(c.topicId, info); else if (c.pastPaperId) byPaper.set(c.pastPaperId, info);
  }
  return { byTopic, byPaper, bySession, isLoading: q.isLoading };
}
