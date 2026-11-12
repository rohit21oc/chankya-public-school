/** Checks for src/utils/classSections.ts (section dropdowns). Run: npx tsx scripts/verify-class-sections.ts */
import { classSectionOptions, sectionForClass } from '../src/utils/classSections';
let failures = 0;
const check = (n: string, ok: boolean) => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}`); };
check('class with A–E shows all five', classSectionOptions({ sections: ['A', 'B', 'C', 'D', 'E'] } as any).join() === 'A,B,C,D,E');
check('class with only A shows only A', classSectionOptions({ sections: ['A'] } as any).join() === 'A');
check('detailed sections added in Academic Structure are included', classSectionOptions({ sections: ['A'], detailedSections: [{ name: 'A' }, { name: 'B', status: 'ACTIVE' }] } as any).join() === 'A,B');
check('switched-off section is left out', classSectionOptions({ sections: ['A', 'B'], detailedSections: [{ name: 'B', status: 'INACTIVE' }] } as any).join() === 'A');
check('no duplicates, natural order, case-insensitive', classSectionOptions({ sections: ['b', 'A', 'B', 'C10', 'C2'] } as any).join() === 'A,b,C2,C10');
check('class change keeps the section when the class has it', sectionForClass({ sections: ['A', 'B', 'C'] } as any, 'B') === 'B');
check('class change picks the first section otherwise', sectionForClass({ sections: ['A'] } as any, 'C') === 'A');
check('no class: empty list', classSectionOptions(null).length === 0);
console.log(failures ? `\n${failures} failed` : '\nAll class section checks passed.');
process.exit(failures ? 1 : 0);
