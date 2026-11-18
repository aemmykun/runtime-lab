import { useQueryClient } from '@tanstack/react-query';
import { FolderKanban, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { createProject } from '~/db/repo';
import { useProjects } from '~/lib/queries';
import { cn } from '~/lib/utils';
import { useSessionStore } from '~/stores/session-store';

export function ProjectsSection() {
  const { data: projects = [] } = useProjects();
  const active = useSessionStore((s) => s.activeProjectId);
  const setActive = useSessionStore((s) => s.setActiveProject);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const qc = useQueryClient();
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          <FolderKanban className="size-3" /> Projects
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setAdding(!adding)} aria-label="New project">
          <Plus />
        </Button>
      </div>
      {adding && (
        <form
          className="flex gap-1"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const p = await createProject(name.trim());
            await qc.invalidateQueries({ queryKey: ['projects'] });
            setActive(p.id);
            setName('');
            setAdding(false);
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" aria-label="Project name" />
          <Button size="sm" type="submit">
            Add
          </Button>
        </form>
      )}
      <ul className="space-y-1">
        {projects.map((p) => (
          <li key={p.id}>
            <button className={cn('w-full rounded px-2 py-1 text-left text-sm', active === p.id ? 'bg-slate-800' : 'hover:bg-slate-900')} onClick={() => setActive(p.id)}>
              {p.name}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
