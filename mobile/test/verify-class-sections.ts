/** npx tsx mobile/test/verify-class-sections.ts */
import assert from 'node:assert/strict';
import { classSectionNames } from '../src/utils/classSections';

let n = 0;
const t = (name: string, fn: () => void) => { fn(); n++; console.log('PASS', name); };

t('all sections the school created are shown (six, not a fixed A/B/C)', () => {
  assert.deepEqual(classSectionNames({ sections: ['A', 'B', 'C', 'D', 'E', 'F'] }), ['A', 'B', 'C', 'D', 'E', 'F']);
});
t('inactive sections are left out when the detailed list is present', () => {
  const cls = { sections: ['A', 'B', 'C', 'D'], detailedSections: [{ name: 'A' }, { name: 'B', status: 'INACTIVE' }, { name: 'C' }, { name: 'D', status: 'ACTIVE' }] };
  assert.deepEqual(classSectionNames(cls), ['A', 'C', 'D']);
});
t('a teacher\'s narrowed list stays narrowed', () => {
  const cls = { sections: ['B'], detailedSections: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] };
  assert.deepEqual(classSectionNames(cls), ['B']);
});
t('object sections, lower case, duplicates and natural order are handled', () => {
  assert.deepEqual(classSectionNames({ sections: [{ id: '1', name: 'b' }, 'a', 'A', 'A10', 'A2'] }), ['A', 'A2', 'A10', 'B']);
  assert.deepEqual(classSectionNames(null), []);
  assert.deepEqual(classSectionNames({ sections: [], detailedSections: [{ name: 'Rose' }, { name: 'Lily' }] }), ['LILY', 'ROSE']);
});
console.log(`\nCLASS SECTIONS: ${n} passed`);
