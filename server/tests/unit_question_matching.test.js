import { describe, it, expect } from 'vitest';
import { calculateSemanticQuestionMatch } from '../src/services/questionMatchingService.js';

describe('Question Matching & Auto-Answer Engine', () => {
  const answeredQuestion = 'Whats the size of the frame?';

  it('matches short question "size ?" against "Whats the size of the frame?"', () => {
    const res = calculateSemanticQuestionMatch('size ?', answeredQuestion);
    expect(res.match).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('matches "dimensions?" against "Whats the size of the frame?"', () => {
    const res = calculateSemanticQuestionMatch('dimensions?', answeredQuestion);
    expect(res.match).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('matches "frame size?" against "Whats the size of the frame?"', () => {
    const res = calculateSemanticQuestionMatch('frame size?', answeredQuestion);
    expect(res.match).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('does NOT match unrelated question like "What is the color of the frame?"', () => {
    const res = calculateSemanticQuestionMatch('What is the color of the frame?', answeredQuestion);
    expect(res.match).toBe(false);
  });

  it('matches condition questions like "any scratch or dent?" with "What is the condition of the bike?"', () => {
    const res = calculateSemanticQuestionMatch('any scratch or dent?', 'What is the condition of the bike?');
    expect(res.match).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('matches battery questions like "battery backup?" with "how long does the battery last?"', () => {
    const res = calculateSemanticQuestionMatch('battery backup?', 'how long does the battery last?');
    expect(res.match).toBe(true);
    expect(res.confidence).toBeGreaterThanOrEqual(0.8);
  });
});

