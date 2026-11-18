import {
  DEFAULT_PRICE_TABLE,
  PROVIDER_IDS,
  PROVIDERS,
  PriceRowError,
  listPriceRows,
  makePriceKey,
  priceRowsToTable,
  type ProviderId,
} from '@runtime-lab/core';
import { Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Input, Select } from '~/components/ui/input';
import { useSettingsStore } from '~/stores/settings-store';

type DraftRow = {
  id: string;
  provider: ProviderId | '';
  model: string;
  input: string;
  output: string;
};

type Field = 'model' | 'inputPerMTok' | 'outputPerMTok';
const isField = (f: string): f is Field => f === 'model' || f === 'inputPerMTok' || f === 'outputPerMTok';
type Issues = Record<string, Partial<Record<Field, string>>>;

let rowSeq = 0;
const nextId = () => `price-row-${++rowSeq}`;

function rowsFromTable(table: typeof DEFAULT_PRICE_TABLE): DraftRow[] {
  return listPriceRows(table).map((r) => ({
    id: nextId(),
    provider: r.provider,
    model: r.model,
    input: String(r.inputPerMTok),
    output: String(r.outputPerMTok),
  }));
}

function sortDraftRows(rows: DraftRow[]): DraftRow[] {
  const stub = {
    note: '',
    prices: Object.fromEntries(rows.map((r, i) => [makePriceKey(r.provider, r.model.trim() || `__draft_${i}`), { inputPerMTok: 0, outputPerMTok: 0 }])),
  };
  return listPriceRows(stub).map((listed) => {
    const match = rows.find((r) => r.provider === listed.provider && (r.model.trim() || `__draft_${rows.indexOf(r)}`) === listed.model);
    return match ?? rows[0]!;
  });
}

function emptyAdd(): DraftRow {
  return { id: 'new', provider: 'openai', model: '', input: '', output: '' };
}

function nameFor(row: DraftRow): string {
  if (row.id === 'new') return 'new model';
  const provider = row.provider ? PROVIDERS[row.provider].label : 'any provider';
  return row.model ? `${provider} ${row.model}` : provider;
}

function groupLabel(provider: ProviderId | ''): string {
  return provider ? PROVIDERS[provider].label : 'Any provider';
}

function ProviderSelect({ row, onChange }: { row: DraftRow; onChange: (provider: ProviderId | '') => void }) {
  return (
    <Select aria-label={`Provider for ${nameFor(row)}`} value={row.provider} onChange={(e) => onChange((e.target.value as ProviderId | '') || '')}>
      <option value="">Any provider</option>
      {PROVIDER_IDS.map((id) => (
        <option key={id} value={id}>
          {PROVIDERS[id].label}
        </option>
      ))}
    </Select>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-red-300">
      {message}
    </p>
  );
}

export function PriceTableEditor() {
  const table = useSettingsStore((s) => s.priceTable);
  const [rows, setRows] = useState<DraftRow[]>(() => rowsFromTable(table));
  const [add, setAdd] = useState<DraftRow>(emptyAdd);
  const [issues, setIssues] = useState<Issues>({});
  const [addIssues, setAddIssues] = useState<Partial<Record<Field, string>>>({});
  const [msg, setMsg] = useState<string>();

  useEffect(() => {
    setRows(rowsFromTable(table));
    setIssues({});
    setAddIssues({});
    setAdd(emptyAdd());
  }, [table]);

  const groups = useMemo(() => {
    const out: Array<{ provider: ProviderId | ''; label: string; rows: DraftRow[] }> = [];
    for (const row of rows) {
      const last = out[out.length - 1];
      if (last && last.provider === row.provider) last.rows.push(row);
      else out.push({ provider: row.provider, label: groupLabel(row.provider), rows: [row] });
    }
    return out;
  }, [rows]);

  const patch = (id: string, partial: Partial<DraftRow>) => {
    setRows((current) => {
      const next = current.map((r) => (r.id === id ? { ...r, ...partial } : r));
      return partial.provider !== undefined ? sortDraftRows(next) : next;
    });
    setMsg(undefined);
  };

  const save = async () => {
    try {
      const next = priceRowsToTable(
        rows.map((r) => ({ provider: r.provider, model: r.model, inputPerMTok: r.input, outputPerMTok: r.output })),
        table,
      );
      setIssues({});
      await useSettingsStore.getState().setPriceTable(next);
      setMsg('Saved.');
    } catch (e) {
      if (e instanceof PriceRowError) {
        const next: Issues = {};
        for (const issue of e.issues) {
          const id = rows[issue.index]?.id;
          if (id && isField(issue.field)) next[id] = { ...next[id], [issue.field]: issue.message };
        }
        setIssues(next);
        setMsg('Fix the highlighted prices before saving.');
        return;
      }
      setMsg((e as Error).message);
    }
  };

  const addModel = () => {
    const candidate: DraftRow = { ...add, id: nextId(), model: add.model.trim() };
    try {
      priceRowsToTable(
        [...rows, candidate].map((r) => ({ provider: r.provider, model: r.model, inputPerMTok: r.input, outputPerMTok: r.output })),
        table,
      );
      setAddIssues({});
      setRows((current) => sortDraftRows([...current, candidate]));
      setAdd(emptyAdd());
      setMsg(undefined);
    } catch (e) {
      if (e instanceof PriceRowError) {
        const next: Partial<Record<Field, string>> = {};
        for (const issue of e.issues) {
          if (issue.index === rows.length && isField(issue.field)) next[issue.field] = issue.message;
        }
        setAddIssues(next);
        if (!Object.keys(next).length) setMsg(e.message);
        return;
      }
      setMsg((e as Error).message);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">{table.note}</p>
      <p className="text-xs text-slate-500">Prices are USD per 1 million tokens. Models not listed show cost as n/a.</p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <caption className="sr-only">Estimated model prices</caption>
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Provider
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Model
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Input $/1M tokens
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Output $/1M tokens
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.provider || 'any'} className="border-t border-border">
              <tr>
                <th scope="colgroup" colSpan={5} className="bg-secondary/60 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                    {group.label}
                    {group.provider && table.sources?.[group.provider] && (
                      <a
                        href={table.sources[group.provider]}
                        target="_blank"
                        rel="noreferrer"
                        className="font-normal normal-case tracking-normal text-sky-400 hover:underline"
                        aria-label={`${group.label} pricing page`}
                      >
                        Pricing page
                      </a>
                    )}
                  </span>
                </th>
              </tr>
              {group.rows.map((row) => {
                const err = issues[row.id] ?? {};
                const who = nameFor(row);
                return (
                  <tr key={row.id} className="border-t border-border align-top">
                    <td className="px-2 py-2">
                      <ProviderSelect row={row} onChange={(provider) => patch(row.id, { provider })} />
                    </td>
                    <td className="px-2 py-2">
                      <Input aria-label={`Model for ${who}`} aria-invalid={!!err.model} aria-describedby={err.model ? `${row.id}-model-error` : undefined} value={row.model} onChange={(e) => patch(row.id, { model: e.target.value })} />
                      <FieldError id={`${row.id}-model-error`} message={err.model} />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        aria-label={`Input $/1M tokens for ${who}`}
                        aria-invalid={!!err.inputPerMTok}
                        aria-describedby={err.inputPerMTok ? `${row.id}-input-error` : undefined}
                        value={row.input}
                        onChange={(e) => patch(row.id, { input: e.target.value })}
                      />
                      <FieldError id={`${row.id}-input-error`} message={err.inputPerMTok} />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        aria-label={`Output $/1M tokens for ${who}`}
                        aria-invalid={!!err.outputPerMTok}
                        aria-describedby={err.outputPerMTok ? `${row.id}-output-error` : undefined}
                        value={row.output}
                        onChange={(e) => patch(row.id, { output: e.target.value })}
                      />
                      <FieldError id={`${row.id}-output-error`} message={err.outputPerMTok} />
                    </td>
                    <td className="px-2 py-2">
                      <Button type="button" size="icon" variant="ghost" aria-label={`Remove ${who}`} onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}>
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
          <tfoot>
            <tr className="border-t border-border bg-slate-900/30 align-top">
              <td className="px-2 py-2">
                <ProviderSelect row={add} onChange={(provider) => setAdd((s) => ({ ...s, provider }))} />
              </td>
              <td className="px-2 py-2">
                <Input aria-label="Model for new model" aria-invalid={!!addIssues.model} aria-describedby={addIssues.model ? 'new-model-error' : undefined} placeholder="Model id" value={add.model} onChange={(e) => setAdd((s) => ({ ...s, model: e.target.value }))} />
                <FieldError id="new-model-error" message={addIssues.model} />
              </td>
              <td className="px-2 py-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  aria-label="Input $/1M tokens for new model"
                  aria-invalid={!!addIssues.inputPerMTok}
                  aria-describedby={addIssues.inputPerMTok ? 'new-input-error' : undefined}
                  placeholder="0"
                  value={add.input}
                  onChange={(e) => setAdd((s) => ({ ...s, input: e.target.value }))}
                />
                <FieldError id="new-input-error" message={addIssues.inputPerMTok} />
              </td>
              <td className="px-2 py-2">
                <Input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  aria-label="Output $/1M tokens for new model"
                  aria-invalid={!!addIssues.outputPerMTok}
                  aria-describedby={addIssues.outputPerMTok ? 'new-output-error' : undefined}
                  placeholder="0"
                  value={add.output}
                  onChange={(e) => setAdd((s) => ({ ...s, output: e.target.value }))}
                />
                <FieldError id="new-output-error" message={addIssues.outputPerMTok} />
              </td>
              <td className="px-2 py-2">
                <Button type="button" size="sm" onClick={addModel}>
                  Add model
                </Button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => void save()}>
          Save prices
        </Button>
        <Button size="sm" variant="outline" onClick={() => void useSettingsStore.getState().resetPriceTable()}>
          Reset to defaults
        </Button>
        {msg && <span className="text-xs text-slate-400">{msg}</span>}
      </div>
    </div>
  );
}
