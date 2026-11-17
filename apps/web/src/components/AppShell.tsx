import { Link } from '@tanstack/react-router';
import { FolderGit2, Heart, Microscope } from 'lucide-react';
import type { ReactNode } from 'react';
import { CREATOR, PRODUCT_NAME, REPO_URL, SPONSOR_URL } from '~/lib/config';

const nav = [
  { to: '/lab', label: 'Lab' },
  { to: '/sample', label: 'Sample trace' },
  { to: '/settings', label: 'Settings' },
  { to: '/about', label: 'About' },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <Microscope className="size-5 text-sky-400" /> {PRODUCT_NAME}
          </Link>
          <nav className="flex gap-4 text-sm text-slate-400">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} className="hover:text-slate-100" activeProps={{ className: 'text-slate-100' }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-slate-400 hover:text-slate-100">
              <FolderGit2 className="size-4" /> GitHub
            </a>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1600px] flex-1">{children}</main>
      <footer className="border-t border-slate-800 text-xs text-slate-500">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
          <span>No backend · No telemetry · MIT licence</span>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-slate-200">
            <FolderGit2 className="size-3" /> {REPO_URL.replace('https://', '')}
          </a>
          <a href={SPONSOR_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-slate-200">
            <Heart className="size-3 text-pink-400" /> Sponsor
          </a>
          <Link to="/about" className="hover:text-slate-200">
            Built in Melbourne by {CREATOR.name}
          </Link>
        </div>
      </footer>
    </div>
  );
}
