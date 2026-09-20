export type HelpTopic = 'jev' | 'review' | 'accept' | 'policy' | 'reviewfeature' | 'scale' | 'tp' | 'fp' | 'fn' | 'tn' | 'precision' | 'recall' | 'f1' | 'yesmed' | 'nomed' | 'capture' | 'viewtoggle' | 'gatedesign';

export const tooltips: Record<HelpTopic, string> = {
  jev: 'Raw semantic signal from Jev (probability the concept is present). Business thresholds never change this number.',
  review: 'Review threshold: the lowest signal level where the business wants a human to inspect the case. Below it, no review is triggered.',
  accept: 'Accept threshold: above this level the workflow accepts the semantic result without human review.',
  policy: 'Policy result: how the business interprets the raw Jev signal at the current thresholds (NO / REVIEW / YES). Not model truth.',
  reviewfeature: 'REVIEW is a deliberate feature: semantic AI is probabilistic, actions carry different risks, and uncertain cases are escalated instead of silently misclassified.',
  scale: 'Policy scale: the two thresholds are boundaries on one 0-1 scale, dividing it into NO / REVIEW / YES zones. The Jev signal is a marker on the same scale; only the boundaries are editable.',
  tp: 'True Positive: the system found something that really was present.',
  fp: 'False Positive (false alarm): the system detected something that was not actually present.',
  fn: 'False Negative: something was present, but the system missed it.',
  tn: 'True Negative: the system correctly ignored something that was not present.',
  precision: 'When the system says YES, how often is it right?',
  recall: 'Of all the real cases, how many did the system find?',
  f1: 'One score balancing precision and recall.',
  yesmed: 'Typical Jev signal for cases that really should be YES.',
  nomed: 'Typical Jev signal for cases that really should be NO.',
  capture: 'Operational capture: how expected-YES cases were actually handled — automatic YES, human REVIEW, or missed entirely. A business view, not a standard ML metric.',
  viewtoggle: 'Business View shows what the system detected and what the business does with it. Technical View shows the underlying Jev request, response, gate definitions and policy calculations for this exact run. Switching does not rerun Jev.',
  gatedesign: 'A good semantic gate is broad enough inside the desired concept and sharp enough at the boundaries against neighboring concepts. Metrics evaluate the gate; they do not define the business concept.'
};

export const details: Record<HelpTopic, { title: string; body: string[] }> = {
  jev: {
    title: 'Jev semantic signal',
    body: [
      'This is the raw semantic result from Jev: the probability (0-1) that the concept is present in the customer text.',
      'Business thresholds do NOT change this value. The same Jev result can be interpreted differently by different businesses.',
      'Thresholds represent business policy, not model truth.',
      'Example: Jev signal 0.63 is just a signal. One business may review at 0.40 (REVIEW); another may ignore until 0.70 (NO).'
    ]
  },
  review: {
    title: 'Review threshold',
    body: [
      'This is the lowest signal level where the business wants human inspection.',
      'Below it, no review is triggered. Changing it does not change the Jev result.',
      'Example: Jev signal 0.58, review threshold 0.40, accept threshold 0.85 => REVIEW.',
      'If the review threshold becomes 0.65, the same Jev signal 0.58 now produces NO.'
    ]
  },
  accept: {
    title: 'Accept threshold',
    body: [
      'Above this level the workflow accepts the semantic result without human review.',
      'The correct threshold depends on the consequences of mistakes (false accepts vs false rejects).',
      'Example: Jev signal 0.91, accept threshold 0.85 => YES.'
    ]
  },
  policy: {
    title: 'Policy result (NO / REVIEW / YES)',
    body: [
      'The deterministic business interpretation of one raw Jev signal given the two thresholds.',
      'NO: below review threshold. REVIEW: between review and accept - routed to a human. YES: at or above accept threshold.',
      'Policy is application code. Changing thresholds re-interprets the SAME Jev signal without re-running Jev.'
    ]
  },
  reviewfeature: {
    title: 'Why REVIEW exists',
    body: [
      'REVIEW is a deliberate V1 feature, not a system failure.',
      'Semantic AI is probabilistic; different actions carry different risks.',
      'Uncertain cases are escalated to humans instead of being silently misclassified.',
      'This is responsible fallback built into the workflow.'
    ]
  },
  scale: {
    title: 'How does this policy scale work?',
    body: [
      'Jev produces a semantic signal between 0 and 1. Example: churn risk = 0.63.',
      'The business then defines two thresholds: review threshold = 0.40 and accept threshold = 0.85.',
      'These create three policy zones:',
      'Below 0.40 → NO → no action.',
      '0.40 to 0.84 → REVIEW → a human inspects the case.',
      '0.85 and above → YES → the signal is accepted automatically.',
      'Changing these thresholds does not change Jev original semantic signal. It only changes how the business responds to that signal.',
      'On the scale, the two circles are the editable boundaries; the ▼ marker is the Jev signal itself and cannot be dragged.'
    ]
  },
  tp: {
    title: 'TP — True Positive',
    body: [
      'A True Positive means: the expected result was YES, and the system also detected it.',
      'Example: the customer writes "I want to cancel my subscription." Expected cancellation intent: YES. System result: YES.',
      'That is one True Positive.',
      'Plain-English summary: correctly found.'
    ]
  },
  fp: {
    title: 'FP — False Positive',
    body: [
      'A False Positive means: the expected result was NO, but the system said YES.',
      'Example: the customer writes "If the connection breaks again, I might cancel." Expected explicit cancellation: NO. System says: YES.',
      'That is a False Positive.',
      'Plain-English summary: false alarm.'
    ]
  },
  fn: {
    title: 'FN — False Negative',
    body: [
      'A False Negative means: the expected result was YES, but the system did not detect it as YES.',
      'Example: the customer writes "Please close my subscription at the end of this month." Expected cancellation: YES. System result: NO.',
      'That is a False Negative.',
      'In this lab a case sent to REVIEW instead of YES also counts as not-YES for these metrics — that is the existing evaluation behavior. See the Operational Capture view for how REVIEW cases were actually handled.',
      'Plain-English summary: missed real case.'
    ]
  },
  tn: {
    title: 'TN — True Negative',
    body: [
      'A True Negative means: the expected result was NO, and the system also said NO.',
      'Example: the customer writes "My brother uses Telia." Expected competitor consideration: NO. System: NO.',
      'That is a True Negative.',
      'Plain-English summary: correctly ignored.'
    ]
  },
  precision: {
    title: 'Precision',
    body: [
      'Precision answers: of all the cases the system detected (said YES), how many really belonged there?',
      'Example: the system says churn risk = YES for 100 customers. If 95 really are churn-risk customers, precision = 95%.',
      'High precision means few false alarms.',
      'This is especially important when a false positive is expensive.'
    ]
  },
  recall: {
    title: 'Recall',
    body: [
      'Recall answers: of everything that really should have been detected, how much did the system catch?',
      'Example: there are actually 100 churn-risk customers. The system finds 95. Recall = 95%.',
      'High recall means few important cases were missed.',
      'This is especially important when missing a real case is expensive.'
    ]
  },
  f1: {
    title: 'F1',
    body: [
      'F1 combines precision and recall into one number.',
      'It is useful when both false alarms and missed cases matter.',
      'It should NOT be treated as the universal definition of system quality: a business may deliberately prefer higher recall for churn detection and stronger precision for another workflow.',
      'That is why Precision and Recall are always shown beside F1.',
      'Plain-English summary: balance between finding the right cases and avoiding false alarms.'
    ]
  },
  yesmed: {
    title: 'YES median signal',
    body: [
      'This shows the middle Jev probability among cases whose expected semantic result was YES.',
      'Example: if real churn cases usually score around 0.96 while real non-churn cases score around 0.16, the gate separates the two groups well.',
      'This is a signal-level view. It is not accuracy.'
    ]
  },
  nomed: {
    title: 'NO median signal',
    body: [
      'This shows the middle Jev probability among cases whose expected semantic result was NO.',
      'A good detector often shows: YES cases → high signals, NO cases → low signals.',
      'No specific number is universally good or bad — it depends on the gate and its business goal.'
    ]
  },
  capture: {
    title: 'Operational Capture (business view)',
    body: [
      'For every case whose expected result was YES, this shows how the workflow actually handled it:',
      'Automatic YES — accepted without a human.',
      'Human REVIEW — sent to a person; not accepted automatically, but not lost.',
      'Missed entirely — below the review threshold; nobody would look at it.',
      'This is an operational/business metric, clearly separate from standard Precision/Recall/F1, which count REVIEW as not-YES.'
    ]
  },
  viewtoggle: {
    title: 'Business View vs Technical View',
    body: [
      'Business View focuses on operational meaning: what was detected, the policy decision, and the resulting business actions.',
      'Technical View exposes the same analysis under the hood — the exact Jev request payload, the raw API response, every gate definition used, the parsed signals, the deterministic policy calculations, and the resulting actions — so developers and technical reviewers can inspect exactly how the result was produced.',
      'Both views refer to the same already-completed run.',
      'Switching views does not rerun Jev; the raw probabilities never change.',
      'The Technical View never contains secrets: the API key lives only in server-side headers and is never serialized into any displayed payload.'
    ]
  },
  gatedesign: {
    title: 'Designing a semantic gate',
    body: [
      'A good semantic gate should represent the business concept you actually care about.',
      'The working design principle in this Lab is: broad enough inside the desired concept, sharp enough at the boundaries against unwanted neighboring concepts.',
      'Example: a churn-risk gate should understand many ways a customer may express that they are considering leaving. But general dissatisfaction alone should not automatically become churn risk.',
      'A gate should not be made narrower simply to improve a metric if that changes what the business actually means.',
      'Metrics evaluate the gate. They do not define the business concept.'
    ]
  }
};
