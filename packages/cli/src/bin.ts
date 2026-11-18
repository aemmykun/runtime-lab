#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { main } from './main.js';

const code = await main(process.argv.slice(2), {
  stdout: (s) => process.stdout.write(`${s}\n`),
  stderr: (s) => process.stderr.write(`${s}\n`),
  readFile: (p) => readFile(p, 'utf8'),
  writeFile: (p, d) => writeFile(p, d, 'utf8'),
  fetch: (url, init) => fetch(url, init),
  env: process.env,
});
process.exitCode = code;
