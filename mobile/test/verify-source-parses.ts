/**
 * Guards against broken merges: every mobile source file must parse.
 * The d0a556e merge pasted both sides of six files together without conflict
 * markers, so a marker search alone did not catch it and main stopped compiling.
 *
 * Run: npx tsx test/verify-source-parses.ts
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';

const root = join(__dirname, '..');
const walk = (dir: string, out: string[] = []): string[] => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|jsx?)$/.test(f)) out.push(p);
  }
  return out;
};

const files = [...walk(join(root, 'src')), ...walk(join(root, 'test')), join(root, 'App.tsx')];
let failed = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const kind = f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, kind) as ts.SourceFile & { parseDiagnostics?: ts.Diagnostic[] };
  const diags = sf.parseDiagnostics || [];
  const markers = /^(<<<<<<<|=======$|>>>>>>>)/m.test(src);
  if (diags.length || markers) {
    failed++;
    const first = diags[0];
    const line = first ? sf.getLineAndCharacterOfPosition(first.start || 0).line + 1 : 0;
    console.log(`  FAIL: ${relative(root, f)}${markers ? ' (conflict marker)' : ''}${first ? ` line ${line}: ${ts.flattenDiagnosticMessageText(first.messageText, ' ')}` : ''}`);
  }
}
console.log(`\nSOURCE PARSE CHECK: ${files.length - failed} files ok, ${failed} broken`);
process.exit(failed === 0 ? 0 : 1);
