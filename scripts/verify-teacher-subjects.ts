/**
 * Subject Expertise / Classes Qualified helpers. Run: npx tsx scripts/verify-teacher-subjects.ts
 */
import { activeSectionNames, migrateTeachingFields, normalizeQualifiedClassSections, qualifiedClassNames, qualifiedSectionsForClass, unifiedSubjectExpertise, uniqueNames } from '../src/utils/teacherSubjects';

let failed = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

check('uniqueNames trims, drops blanks and duplicates (any case)', same(uniqueNames([' Math ', 'math', '', null, 'Hindi']), ['Math', 'Hindi']));

const legacy = {
  id: 't1',
  subjectExpertise: ['Mathematics'],
  additionalSubjects: ['Science', 'mathematics'],
  teachingProfile: { subjectExpertise: ['Mathematics'], additionalSubjects: ['Computer'], assignedPrimarySubject: 'Mathematics' },
};
check('Expertise includes old Additional Subjects, no duplicates', same(unifiedSubjectExpertise(legacy), ['Mathematics', 'Science', 'Computer']));

const m = migrateTeachingFields(legacy);
check('Migration reports a change', m.changed === true);
const ms: any = m.staff;
check('Additional Subjects field is gone', !('additionalSubjects' in ms) && !('additionalSubjects' in ms.teachingProfile));
check('Subject Expertise keeps every old subject', same(ms.subjectExpertise, ['Mathematics', 'Science', 'Computer']) && same(ms.teachingProfile.subjectExpertise, ['Mathematics', 'Science', 'Computer']));
check('Other fields are untouched', ms.id === 't1' && ms.teachingProfile.assignedPrimarySubject === 'Mathematics');
check('Original record is not mutated', Array.isArray(legacy.additionalSubjects) && legacy.additionalSubjects.length === 2);
check('Running the migration again changes nothing', migrateTeachingFields(m.staff).changed === false);
check('A record without the old field is left alone', migrateTeachingFields({ id: 't2', subjectExpertise: ['Hindi'] }).changed === false);
check('Empty old field is just removed', migrateTeachingFields({ id: 't3', subjectExpertise: ['Hindi'], additionalSubjects: [] }).staff.subjectExpertise?.join() === 'Hindi');

check('Qualified classes from array', same(qualifiedClassNames({ qualifiedClasses: ['Class 1', 'Class 2'] }), ['Class 1', 'Class 2']));
check('Qualified classes from comma text', same(qualifiedClassNames({ classesQualifiedToTeach: 'Class 1, Class 3' }), ['Class 1', 'Class 3']));
check('Qualified classes merge all sources without duplicates', same(qualifiedClassNames({ qualifiedClasses: ['Class 1'], classesQualifiedToTeach: 'Class 1, Class 2', teachingProfile: { classesQualifiedToTeach: ['class 2', 'Class 4'] } }), ['Class 1', 'Class 2', 'Class 4']));
check('No staff gives empty lists', unifiedSubjectExpertise(null).length === 0 && qualifiedClassNames(undefined).length === 0);

// Sections per qualified class
const nursery = { id: 'c-nur', name: 'Nursery', sections: ['A', 'B', 'C', 'D', 'E', 'F'], detailedSections: ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => ({ name: n, status: n === 'E' ? 'INACTIVE' : 'ACTIVE' })) };
check('Active sections come from Academics (inactive left out)', same(activeSectionNames(nursery), ['A', 'B', 'C', 'D', 'F']));
check('Plain section list works too', same(activeSectionNames({ sections: ['a', 'B'] }), ['A', 'B']));
check('Chosen sections only', same(qualifiedSectionsForClass({ qualifiedClasses: ['Nursery'], qualifiedClassSections: [{ className: 'Nursery', sections: ['B', 'E', 'F'] }] }, nursery), ['B', 'F']));
check('Older record without a choice keeps every active section', same(qualifiedSectionsForClass({ qualifiedClasses: ['Nursery'] }, nursery), ['A', 'B', 'C', 'D', 'F']));
check('Not qualified for the class → no sections even if listed', qualifiedSectionsForClass({ qualifiedClasses: ['LKG'], qualifiedClassSections: [{ className: 'Nursery', sections: ['A'] }] }, nursery).length === 0);
check('Empty choice → no sections', qualifiedSectionsForClass({ qualifiedClasses: ['Nursery'], qualifiedClassSections: [{ className: 'Nursery', sections: [] }] }, nursery).length === 0);
const norm = normalizeQualifiedClassSections([{ className: 'nursery', sections: ['b', ' a ', 'B'] }, { className: 'Class 9', sections: ['A'] }, null, 'x'], ['Nursery']);
check('Saved sections are cleaned to qualified classes, upper case, unique', JSON.stringify(norm) === JSON.stringify([{ className: 'Nursery', sections: ['B', 'A'] }]));
check('Bad input saves nothing', normalizeQualifiedClassSections('x', ['Nursery']).length === 0);

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nAll teacher subject checks passed.');
