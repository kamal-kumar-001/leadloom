import { it, expect } from 'vitest';
import { captureSurveyResponses } from './capture-survey-responses';
const questions = [{ text: 'Pain?', type: 'text' as const }, { text: 'Size?', type: 'choice' as const, options: ['Small', 'Large'] }];
it('saves an untouched choice exactly as displayed, with the text answer', () => {
  expect(captureSurveyResponses(questions, { 'Pain?': 'Manual work' })).toEqual({ 'Pain?': 'Manual work', 'Size?': 'Small' });
});
it('keeps an explicit selection and excludes stale answers for absent questions', () => {
  expect(captureSurveyResponses(questions, { 'Pain?': 'Slow', 'Size?': 'Large', stale: 'Old' })).toEqual({ 'Pain?': 'Slow', 'Size?': 'Large' });
});
it('does not inherit object prototype values for custom question text', () => {
  expect(captureSurveyResponses([{text:'constructor',type:'text'},{text:'toString',type:'choice',options:['First','Second']}],{})).toEqual({constructor:'',toString:'First'});
});
it('does not invent an answer when a question has no options', () => {
  expect(captureSurveyResponses([{ text: 'Empty?', type: 'choice' }], {})).toEqual({ 'Empty?': '' });
});
