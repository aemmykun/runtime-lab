import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { EXPORT_TARGETS, exportRun } from '../src/exporters.js';
import { PROVIDER_IDS } from '../src/providers.js';
import { SAMPLE_RUN } from '../src/sample.js';
import type { RunConfig } from '../src/types.js';

const hasPython = (() => {
  try {
    execFileSync('python3', ['--version']);
    return true;
  } catch {
    return false;
  }
})();

function tsSyntaxErrors(code: string): string[] {
  const out = ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return (out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

describe('export to code', () => {
  for (const provider of PROVIDER_IDS) {
    const config: RunConfig = { ...SAMPLE_RUN.config, provider, model: `model-for-${provider}` };
    for (const t of EXPORT_TARGETS) {
      it(`${t.id} for ${provider} uses the run's model, reads the key from env and is syntactically valid`, () => {
        const code = exportRun(config, t.id);
        expect(code).toContain(`model-for-${provider}`);
        expect(code).not.toMatch(/gpt-5(?!-)/); // never a hard-coded default model
        expect(code).toMatch(/process\.env\.|os\.environ/);
        expect(code).not.toMatch(/sk-[A-Za-z0-9]{8,}/);
        if (t.id === 'python') {
          if (hasPython) {
            const dir = mkdtempSync(join(tmpdir(), 'rl-'));
            const f = join(dir, 'run.py');
            writeFileSync(f, code);
            execFileSync('python3', ['-c', `import ast,sys; ast.parse(open(sys.argv[1]).read())`, f]);
          }
        } else {
          expect(tsSyntaxErrors(code)).toEqual([]);
        }
      });
    }
  }

  it('AI SDK export uses generateText with tools, mocks and step limit', () => {
    const code = exportRun(SAMPLE_RUN.config, 'typescript-ai-sdk');
    expect(code).toContain("import { generateText, tool, jsonSchema, isStepCount } from 'ai'");
    expect(code).toContain("import { createOpenAI } from '@ai-sdk/openai'");
    expect(code).toContain('instructions: "You are a support agent. Use tools to answer."');
    expect(code).toContain('stopWhen: isStepCount(5)');
    expect(code).toContain('"not_found"');
  });

  it('Anthropic exports use the Anthropic SDKs', () => {
    const c = { ...SAMPLE_RUN.config, provider: 'anthropic' as const, model: 'claude-x' };
    expect(exportRun(c, 'typescript-openai')).toContain("import Anthropic from '@anthropic-ai/sdk'");
    expect(exportRun(c, 'python')).toContain('from anthropic import Anthropic');
    expect(exportRun(c, 'typescript-ai-sdk')).toContain("import { createAnthropic } from '@ai-sdk/anthropic'");
  });
});
