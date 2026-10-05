import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const gates = [
  ['billing_problem', ['💳💸', '🧾✅'], ['🎁💚', '🛒😊']],
  ['technical_problem', ['📶🛠️', '🔌⚠️'], ['📶✅', '🛠️✨']],
  ['contract_problem', ['📝📄', '🔏📑'], ['🔓🎉', '🪪✅']],
  ['support_interaction_problem', ['📞⏳', '🙋‍♂️💬'], ['🤝😊', '📞✅']],
  ['unresolved_issue', ['⏳🔁', '🧩❓'], ['✅🎉', '🏁✨']],
  ['recurring_problem', ['🔁⚠️', '♻️😣'], ['1️⃣✅', '🆕✨']],
  ['positive_support_experience', ['😊👍', '💚🌟'], ['😡💢', '💔😤']],
  ['negative_support_experience', ['😡😤', '💢👎'], ['😊👍', '💚✨']],
  ['competitor_consideration', ['⚔️🏁', '🔭🏢'], ['🏠❤️', '🤝🔒']],
  ['churn_risk', ['🚪🏃', '🧳👋'], ['🏠❤️', '🔒😊']],
  ['explicit_cancellation_intent', ['🛑❌', '🚫📴'], ['🔄✅', '▶️😊']]
];
const byGate = new Map(gates);
const source = [
  ['testcases.v1.json', 'testcases.emoji.v1.json', 'en'],
  ['testcases.v1-sv.json', 'testcases.emoji.v1-sv.json', 'sv']
];
for (const [input, output, language] of source) {
  const data = JSON.parse(fs.readFileSync(path.join(root, 'src/BizzJev.Lab/config', input), 'utf8'));
  const cases = data.cases.map((item, index) => {
    const [target, matching, opposing] = gates[index % gates.length];
    const [other, otherMatching, otherOpposing] = gates[(index + 5) % gates.length];
    const match = index % 2 === 0;
    const first = match ? matching[index % matching.length] : opposing[index % opposing.length];
    const second = match ? otherOpposing[index % otherOpposing.length] : otherMatching[index % otherMatching.length];
    const cue = language === 'sv'
      ? `\n\nEmoji-stresstest: ${first} ${second}. Emojis kan stödja eller motsäga texten; bedöm hela kundmeddelandet.`
      : `\n\nEmoji stress test: ${first} ${second}. Emojis may support or contradict the text; judge the complete customer message.`;
    return {
      ...item,
      customerText: `${item.customerText}${cue}`,
      emojiTest: { targetGate: target, secondaryGate: other, mode: match ? 'matching-target-opposing-secondary' : 'opposing-target-matching-secondary', emojis: [first, second] }
    };
  });
  fs.writeFileSync(path.join(root, 'src/BizzJev.Lab/config', output), JSON.stringify({
    datasetVersion: 'emoji-v1', language, sourceDataset: 'v1', note: 'Same 100 cases and labels as v1; deterministic matching/opposing emoji cues appended for stress testing.', cases
  }, null, 2) + '\n');
}
console.log('Generated 100 EN + 100 SV emoji stress cases.');
