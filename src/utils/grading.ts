import { GradeDefinition } from '../types';

export const OFFICIAL_GRADING_SYSTEM: GradeDefinition[] = [
  {
    grade: 'A1',
    minPercentage: 91,
    maxPercentage: 100,
    gradePoint: 10,
    status: 'PASS',
    description: 'Outstanding performance',
  },
  {
    grade: 'A2',
    minPercentage: 81,
    maxPercentage: 90,
    gradePoint: 9,
    status: 'PASS',
    description: 'Excellent understanding',
  },
  {
    grade: 'B1',
    minPercentage: 71,
    maxPercentage: 80,
    gradePoint: 8,
    status: 'PASS',
    description: 'Very good achievement',
  },
  {
    grade: 'B2',
    minPercentage: 61,
    maxPercentage: 70,
    gradePoint: 7,
    status: 'PASS',
    description: 'Good comprehension',
  },
  {
    grade: 'C1',
    minPercentage: 51,
    maxPercentage: 60,
    gradePoint: 6,
    status: 'PASS',
    description: 'Fair proficiency',
  },
  {
    grade: 'C2',
    minPercentage: 41,
    maxPercentage: 50,
    gradePoint: 5,
    status: 'PASS',
    description: 'Average understanding',
  },
  {
    grade: 'D',
    minPercentage: 33,
    maxPercentage: 40,
    gradePoint: 4,
    status: 'PASS',
    description: 'Pass grade',
  },
  {
    grade: 'E/F',
    minPercentage: 0,
    maxPercentage: 32,
    gradePoint: 0,
    status: 'FAIL',
    description: 'Essential repeat required',
  },
];

export interface EvaluationResult {
  grade: string;
  gradePoint: number;
  status: 'PASS' | 'FAIL' | 'N/A';
  percentage: number;
  remark: string;
}

export function calculateEvaluation(obtained: number, max: number): EvaluationResult {
  if (max <= 0) {
    return {
      grade: 'N/A',
      gradePoint: 0,
      status: 'N/A',
      percentage: 0,
      remark: 'No marks recorded',
    };
  }

  const percentage = Math.round(((obtained / max) * 100) * 10) / 10;

  if (percentage >= 91) {
    return { grade: 'A1', gradePoint: 10, status: 'PASS', percentage, remark: 'Outstanding' };
  } else if (percentage >= 81) {
    return { grade: 'A2', gradePoint: 9, status: 'PASS', percentage, remark: 'Excellent' };
  } else if (percentage >= 71) {
    return { grade: 'B1', gradePoint: 8, status: 'PASS', percentage, remark: 'Very Good' };
  } else if (percentage >= 61) {
    return { grade: 'B2', gradePoint: 7, status: 'PASS', percentage, remark: 'Good' };
  } else if (percentage >= 51) {
    return { grade: 'C1', gradePoint: 6, status: 'PASS', percentage, remark: 'Fair' };
  } else if (percentage >= 41) {
    return { grade: 'C2', gradePoint: 5, status: 'PASS', percentage, remark: 'Average' };
  } else if (percentage >= 33) {
    return { grade: 'D', gradePoint: 4, status: 'PASS', percentage, remark: 'Pass' };
  } else {
    // Critical rule: <33% (e.g. 32.9%) is FAIL / Essential Repeat
    return { grade: 'E/F', gradePoint: 0, status: 'FAIL', percentage, remark: 'Essential Repeat' };
  }
}

export function calculateGradeFromMarks(obtained: number, max: number) {
  const evalRes = calculateEvaluation(obtained, max);
  return {
    ...evalRes,
    isPass: evalRes.status === 'PASS',
  };
}

export function getGradeRemark(grade: string): string {
  switch (grade) {
    case 'A1':
      return 'Outstanding performance';
    case 'A2':
      return 'Excellent grasp';
    case 'B1':
      return 'Very good effort';
    case 'B2':
      return 'Good comprehension';
    case 'C1':
      return 'Fair proficiency';
    case 'C2':
      return 'Average understanding';
    case 'D':
      return 'Pass grade';
    case 'E/F':
    case 'E':
    case 'F':
      return 'Essential repeat required';
    default:
      return 'Satisfactory';
  }
}

export function getPromotionalStatus(obtained: number, max: number): {
  statusText: string;
  badgeText: string;
  remark: string;
} {
  const evalRes = calculateEvaluation(obtained, max);
  if (evalRes.status === 'PASS') {
    return {
      statusText: 'PROMOTED TO NEXT CLASS',
      badgeText: 'PASSED & PROMOTED',
      remark: 'Commendable academic progress. Promoted to next class.',
    };
  }
  return {
    statusText: 'ESSENTIAL REPEAT / REMEDIAL',
    badgeText: 'FAIL / ESSENTIAL REPEAT',
    remark: 'Essential repeat required. Student needs intensive remedial guidance and academic re-evaluation.',
  };
}
