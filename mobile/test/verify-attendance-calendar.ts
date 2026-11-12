import { buildMonthModel, shiftMonth, kindFromStatus } from '../src/utils/attendanceCalendarModel';
let passed = 0, failed = 0;
const ok = (d: string, c: boolean) => { if (c) { passed++; console.log(`  ✅ ${d}`); } else { failed++; console.error(`  ❌ ${d}`); } };

const m = buildMonthModel({
  year: 2026, month: 9, todayIso: '2026-10-22',
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  records: [
    { date: '2026-10-01', status: 'PRESENT' }, { date: '2026-10-02', status: 'LATE', checkInTime: '09:20' },
    { date: '2026-10-05', status: 'ABSENT' }, { date: '2026-10-06', status: 'ON_LEAVE' }, { date: '2026-10-07', status: 'HALF_DAY' },
    { date: '2026-10-08', status: '' }, { date: '2026-10-09', status: 'NOT_MARKED' },
  ],
  holidays: [{ name: 'Dussehra', date: '2026-10-20', endDate: '2026-10-21' }, { name: 'Gandhi Jayanti', date: '2026-10-02' }],
  leaves: [{ startDate: '2026-10-12', endDate: '2026-10-13', status: 'APPROVED', leaveType: 'SICK' }, { startDate: '2026-10-14', endDate: '2026-10-14', status: 'PENDING' }],
});
const day = (n: number) => m.weeks.flat().find((d) => d && d.day === n)!;
ok('title and 31 days', m.title === 'October 2026' && m.weeks.flat().filter(Boolean).length === 31);
ok('grid rows have 7 cells, Oct 1 2026 is Thursday', m.weeks.every((w) => w.length === 7) && m.weeks[0].findIndex((d) => d?.day === 1) === 4);
ok('present / late / half / absent / leave', day(1).kind === 'PRESENT' && day(2).kind === 'LATE' && day(7).kind === 'HALF_DAY' && day(5).kind === 'ABSENT' && day(6).kind === 'LEAVE');
ok('attendance record wins over a holiday on the same day', day(2).kind === 'LATE');
ok('holiday range covers both days with its name', day(20).kind === 'HOLIDAY' && day(21).kind === 'HOLIDAY' && day(20).detail === 'Dussehra');
ok('approved leave shows as leave, pending does not', day(12).kind === 'LEAVE' && day(13).kind === 'LEAVE' && day(14).kind === 'NO_RECORD');
ok('blank/NOT_MARKED statuses are not attendance', day(8).kind === 'NO_RECORD' && day(9).kind === 'NO_RECORD');
ok('weekly off from school working days (Sunday)', day(4).kind === 'WEEK_OFF' && day(11).kind === 'WEEK_OFF');
ok('past day without record is NO_RECORD, never absent', day(15).kind === 'NO_RECORD');
ok('future day is FUTURE', day(23).kind === 'FUTURE' && day(30).kind === 'FUTURE' && day(25).kind === 'WEEK_OFF');
ok('totals add up to month length', Object.values(m.totals).reduce((a, b) => a + b, 0) + m.weeks.flat().filter((d) => d?.kind === 'FUTURE').length === 31);
ok('present total counts only present', m.totals.present === 1 && m.totals.late === 1 && m.totals.absent === 1 && m.totals.halfDay === 1);

const noSettings = buildMonthModel({ year: 2026, month: 9, todayIso: '2026-10-22', records: [] });
// Without saved working days the school default (Monday–Saturday, same as the server) is used.
ok('without working-day settings Sundays are weekly offs (default Mon–Sat)', noSettings.totals.weekOff === 4 && !noSettings.hasAnyRecord);

// Monday as weekly off (School Working Days without Monday): November 2026, today 20th.
const nov = buildMonthModel({
  year: 2026, month: 10, todayIso: '2026-11-20', salaryCut: true,
  workingDays: ['Sunday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  records: [{ date: '2026-11-03', status: 'ABSENT' }, { date: '2026-11-04', status: 'PRESENT' }, { date: '2026-11-07', status: 'PRESENT' }],
  holidays: [{ name: 'Children Day', date: '2026-11-14' }],
});
const nd = (n: number) => nov.weeks.flat().find((d) => d && d.day === n)!;
ok('Monday off: Mondays are weekly off, Sundays are working days', nd(2).kind === 'WEEK_OFF' && nd(9).kind === 'WEEK_OFF' && nd(1).kind === 'NO_RECORD');
ok('salary cut: absent day', nd(3).salaryCut === true && /salary cut/.test(nd(3).detail));
ok('salary cut: past unmarked working day', nd(5).salaryCut === true && nd(1).salaryCut === true);
ok('no cut on weekly off, holiday, present, today or future', !nd(2).salaryCut && !nd(14).salaryCut && !nd(4).salaryCut && !nd(20).salaryCut && !nd(25).salaryCut);
// Working days 1–19 except Mondays (2, 9, 16) and the 14th holiday = 15; present 4th, 7th → 13 cut (incl. absent 3rd).
ok('salary-cut total for the month so far', nov.totals.salaryCut === 13);
const novStudent = buildMonthModel({ year: 2026, month: 10, todayIso: '2026-11-20', workingDays: ['Sunday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], records: [{ date: '2026-11-03', status: 'ABSENT' }] });
ok('students (salaryCut off): nothing marked as a cut', novStudent.totals.salaryCut === 0 && !novStudent.weeks.flat().some((d) => d?.salaryCut));
const oct = buildMonthModel({ year: 2026, month: 9, todayIso: '2026-11-20', salaryCut: true, records: [{ date: '2026-10-05', status: 'ABSENT' }] });
ok('before the rule start (Oct): unmarked days not cut, absence still cut', oct.totals.salaryCut === 1);
ok('month navigation wraps years', shiftMonth(2026, 0, -1).year === 2025 && shiftMonth(2026, 0, -1).month === 11 && shiftMonth(2026, 11, 1).year === 2027);
ok('status mapping', kindFromStatus('on leave') === 'LEAVE' && kindFromStatus('LWP') === 'ABSENT' && kindFromStatus('NOT_MARKED') === null);
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
