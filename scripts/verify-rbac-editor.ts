/** Pure checks for src/utils/rbacEditor.ts (Roles & Permissions page). Run: npx tsx scripts/verify-rbac-editor.ts */
import assert from 'node:assert/strict';
import { diff, effective, grantAll, isOn, normalize, resetKeys, togglePermission } from '../src/utils/rbacEditor';

const tpl = ['a', 'b'];
let o = { granted: [] as string[], denied: [] as string[] };

// Grant a permission the role does not have (the old page silently lost this).
o = togglePermission('c', tpl, o);
assert.deepEqual(o, { granted: ['c'], denied: [] });
assert.equal(isOn('c', tpl, o), true);
// Toggle again: back to template, no leftover override.
o = togglePermission('c', tpl, o);
assert.deepEqual(o, { granted: [], denied: [] });
// Remove a template permission, then restore it.
o = togglePermission('a', tpl, o);
assert.deepEqual(o, { granted: [], denied: ['a'] });
assert.equal(isOn('a', tpl, o), false);
o = togglePermission('a', tpl, o);
assert.deepEqual(o, { granted: [], denied: [] });
// Grant all in a module clears denies and grants only what the template lacks.
o = grantAll(['a', 'c', 'd'], tpl, { granted: [], denied: ['a'] });
assert.deepEqual(o, { granted: ['c', 'd'], denied: [] });
assert.deepEqual(effective(tpl, o).sort(), ['a', 'b', 'c', 'd']);
// Reset one module.
assert.deepEqual(resetKeys(['c'], o), { granted: ['d'], denied: [] });
// Role change drops overrides that now repeat the new template.
assert.deepEqual(normalize(['c', 'x'], { granted: ['c', 'd'], denied: ['a', 'x'] }), { granted: ['d'], denied: ['x'] });
// Diff
assert.deepEqual(diff(['a', 'b'], ['b', 'c']), { added: ['c'], removed: ['a'] });
console.log('verify-rbac-editor: all checks passed');
