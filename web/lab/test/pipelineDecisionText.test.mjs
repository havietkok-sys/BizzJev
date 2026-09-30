import assert from 'node:assert/strict';
import { explanationText, reviewText, actionText, errorText } from '../src/pipelineDecisionText.ts';

const decision = { proposedTeam: 'Technical' };
for (const [ruleId, word] of [
  ['PRIORITY_NORMAL', 'normal'],
  ['PRIORITY_ELEVATED', 'förhöjd'],
  ['PRIORITY_URGENT', 'brådskande'],
  ['CANCELLATION_YES', 'JA'],
  ['OUTCOME_TECHNICAL_FAILURE', 'tekniskt']
]) {
  assert.match(explanationText({ ruleId, text: 'English wire detail' }, 'sv'), new RegExp(word, 'i'));
  assert.equal(explanationText({ ruleId, text: 'English wire detail' }, 'en'), 'English wire detail');
}
assert.match(reviewText({ code: 'routing_uncertain', detail: 'English review' }, 'sv'), /osäkert/);
assert.match(actionText({ type: 'route_to_team', label: 'English action' }, decision, 'sv'), /Teknik/);
assert.match(actionText({ type: 'cancellation_handling', label: 'English action' }, decision, 'sv'), /uppsägning/);
assert.match(errorText({ category: 'urgency', code: 'missing_answer', detail: 'English failure' }, 'sv'), /Svar saknas/);
