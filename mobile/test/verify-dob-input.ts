import { formatDobInput } from '../src/utils/dobInput';

let failed = 0;
const check = (name: string, ok: boolean) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failed++;
};

check('typing digits adds hyphens (27122003)', formatDobInput('27122003') === '27-12-2003');
check('partial: 2 digits has no hyphen yet', formatDobInput('27') === '27');
check('partial: 3 digits', formatDobInput('271') === '27-1');
check('partial: 4 digits', formatDobInput('2712') === '27-12');
check('partial: 5 digits', formatDobInput('27122') === '27-12-2');
check('already formatted stays the same', formatDobInput('27-12-2003') === '27-12-2003');
check('backspace over a hyphen ("27-" -> "27")', formatDobInput('27-') === '27');
check('slashes and dots are converted', formatDobInput('27/12/2003') === '27-12-2003' && formatDobInput('27.12.2003') === '27-12-2003');
check('extra digits are cut at 8', formatDobInput('271220031234') === '27-12-2003');
check('empty stays empty', formatDobInput('') === '');
check('a password with letters is left untouched', formatDobInput('Cps@1234') === 'Cps@1234');
check('a password with digits and symbols is untouched', formatDobInput('1234#abc') === '1234#abc');
const step = ['2', '27', '271', '2712', '27122', '271220', '2712200', '27122003'].map(formatDobInput);
check('typed one digit at a time', step[7] === '27-12-2003' && step[2] === '27-1');

if (failed) {
  console.error(`${failed} check(s) failed`);
  process.exit(1);
}
console.log('All DOB input checks passed');
