import { describe, expect, it } from 'vitest';
import { checklistProgress, descriptionFields, htmlToText } from '@/lib/html-text';

const checklist =
  '<ul data-type="taskList">' +
  '<li data-checked="true" data-type="taskItem"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Draft</p></div></li>' +
  '<li data-checked="false" data-type="taskItem"><label><input type="checkbox"><span></span></label><div><p>Review</p></div></li>' +
  '<li data-type="taskItem" data-checked="true"><label><input type="checkbox"><span></span></label><div><p>Send</p></div></li>' +
  '</ul>';

describe('htmlToText', () => {
  it('strips tags, decodes entities and collapses spaces', () => {
    expect(htmlToText('<p>Fix&nbsp;the <strong>invoice</strong> &amp; send</p>')).toBe('Fix the invoice & send');
  });

  it('keeps Arabic text', () => {
    expect(htmlToText('<p>مراجعة <em>الميزانية</em></p>')).toBe('مراجعة الميزانية');
  });
});

describe('checklistProgress', () => {
  it('counts task items regardless of attribute order', () => {
    expect(checklistProgress(checklist)).toEqual({ total: 3, done: 2 });
  });

  it('ignores ordinary list items', () => {
    expect(checklistProgress('<ul><li><p>a</p></li></ul>')).toEqual({ total: 0, done: 0 });
  });
});

describe('descriptionFields', () => {
  it('derives search text and checklist counts together', () => {
    expect(descriptionFields(`<p>Plan</p>${checklist}`)).toEqual({
      descriptionText: 'Plan Draft Review Send',
      checklistTotal: 3,
      checklistDone: 2,
    });
  });
});
