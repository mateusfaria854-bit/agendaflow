import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../specs/', import.meta.url);
const dir = root.pathname;
let checked = 0;
for (const folder of readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory() && /^\d+-/.test(e.name))) {
  const base = join(dir, folder.name);
  for (const name of ['spec.md', 'plan.md', 'tasks.md']) {
    const path = join(base, name);
    if (!existsSync(path)) throw new Error(`Spec incompleta: ${folder.name}/${name}`);
    const text = readFileSync(path, 'utf8').trim();
    if (text.length < 120 || !text.startsWith('# ')) throw new Error(`Documento incompleto: ${path}`);
  }
  const spec = readFileSync(join(base, 'spec.md'), 'utf8');
  if (!/## Requisitos/i.test(spec) || !/## Critérios de aceitação/i.test(spec)) {
    throw new Error(`Requisitos ou aceite ausentes em ${folder.name}`);
  }
  const tasks = readFileSync(join(base, 'tasks.md'), 'utf8');
  if (!/- \[[ x]\]/.test(tasks)) throw new Error(`Checklist ausente: ${folder.name}`);
  checked++;
}
if (!checked) throw new Error('Nenhuma especificação versionada encontrada em specs/');
console.log(`SDD: ${checked} especificação(ões) completas.`);
