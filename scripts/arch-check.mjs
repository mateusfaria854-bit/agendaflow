import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const path = join(dir, item.name);
    return item.isDirectory() ? sourceFiles(path) : /\.[cm]?[jt]sx?$/.test(item.name) ? [path] : [];
  });
}
const checks = [
  {
    dir: 'packages/shared/src',
    forbidden: /\b(?:from\s+['"](?:react|fastify|pg|node:|@agendaflow\/api)|\bwindow\.|\bdocument\.)/,
    label: 'Pacote shared depende do navegador ou servidor',
  },
  {
    dir: 'apps/web/src',
    forbidden: /\bfrom\s+['"](?:pg|fastify|node:|@agendaflow\/api)/,
    label: 'Frontend importando infraestrutura do servidor',
  },
];
for (const check of checks) {
  for (const path of sourceFiles(check.dir)) {
    if (check.forbidden.test(readFileSync(path, 'utf8'))) throw new Error(`${check.label}: ${path}`);
  }
}
console.log('Arquitetura: fronteiras básicas verificadas.');
