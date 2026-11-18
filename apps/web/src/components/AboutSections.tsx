import { PROVIDERS } from '@runtime-lab/core';
import { ExternalLink, Heart, User } from 'lucide-react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { CREATOR, PRODUCT_NAME, REPO_URL, SPONSOR_URL } from '~/lib/config';

export function CreatorSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-4" /> About the creator
        </CardTitle>
        <CardDescription>
          {CREATOR.name} · {CREATOR.location}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-slate-300">
        <p>{CREATOR.summary}</p>
        <p>{CREATOR.project.summary}</p>
        <p>
          <a href={CREATOR.project.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:underline">
            {CREATOR.project.name} – {CREATOR.project.url.replace('https://', '')} <ExternalLink className="size-3" />
          </a>
        </p>
        <p className="text-slate-500">{CREATOR.education}</p>
      </CardContent>
    </Card>
  );
}

export function SupportSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-4 text-pink-400" /> Support / Sponsor
        </CardTitle>
        <CardDescription>{PRODUCT_NAME} is free and open source (MIT). If it saves you debugging time, you can support its development.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={SPONSOR_URL} target="_blank" rel="noreferrer">
            <Heart /> Sponsor on GitHub
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Star or contribute on GitHub
          </a>
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProviderSupportTable() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provider support in the browser</CardTitle>
        <CardDescription>Checked with a CORS preflight on 18 Nov 2026 (AEDT). Providers can change this. There is no proxy fallback by design.</CardDescription>
      </CardHeader>
      <CardContent>
        <table className="w-full text-left text-sm">
          <tbody>
            {Object.values(PROVIDERS).map((p) => (
              <tr key={p.id} className="border-t border-slate-800 align-top">
                <td className="py-2 pr-2 font-medium">{p.label}</td>
                <td className="py-2 pr-2">
                  <Badge variant={p.browser === 'supported' ? 'success' : 'warn'}>{p.browser === 'supported' ? 'direct' : 'local, needs CORS'}</Badge>
                </td>
                <td className="py-2 text-xs text-slate-400">
                  {p.browserNote} <span className="font-mono">{p.baseUrl}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
