import type { Run } from '@runtime-lab/core';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { getRun } from '~/db/repo';
import { TraceDiff } from '~/features/traces/TraceDiff';

function ComparePage() {
  const { a, b } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ['compare', a, b],
    queryFn: async () => [await getRun(a), await getRun(b)] as Array<Run | undefined>,
  });
  if (isLoading) return <p className="p-8 text-slate-400">Loading…</p>;
  const [ra, rb] = data ?? [];
  if (!ra || !rb)
    return (
      <p className="p-8 text-slate-400">
        One of these runs is not in this browser&apos;s lab. <Link to="/lab" className="text-sky-400">Back to the lab</Link>
      </p>
    );
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Compare runs</h1>
      <TraceDiff a={ra} b={rb} />
    </div>
  );
}

export const Route = createFileRoute('/compare')({
  validateSearch: (s: Record<string, unknown>) => ({ a: String(s.a ?? ''), b: String(s.b ?? '') }),
  component: ComparePage,
});
