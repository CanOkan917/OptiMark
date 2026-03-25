import type { TemplateSummary } from '../core/types/template';

export const localTemplates: TemplateSummary[] = [
  {
    id: 'tmplt-midterm-v1',
    name: 'Midterm A4 - 40Q',
    questionCount: 40,
    choices: ['A', 'B', 'C', 'D'],
    updatedAt: '2026-03-24',
    description: 'Standard 40-question multiple-choice sheet with student ID lane.',
  },
  {
    id: 'tmplt-quiz-v2',
    name: 'Quick Quiz - 20Q',
    questionCount: 20,
    choices: ['A', 'B', 'C', 'D'],
    updatedAt: '2026-03-22',
    description: 'Compact short exam template optimized for rapid classroom scans.',
  },
  {
    id: 'tmplt-mock-v3',
    name: 'Mock Exam - 60Q',
    questionCount: 60,
    choices: ['A', 'B', 'C', 'D', 'E'],
    updatedAt: '2026-03-20',
    description: 'Higher capacity sheet with five-option bubbles for practice exams.',
  },
];
