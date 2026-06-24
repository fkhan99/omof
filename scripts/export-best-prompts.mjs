import fs from 'fs';

const transcriptPath =
  'C:/Users/Farhan/.cursor/projects/c-Users-Farhan-Projects-omof/agent-transcripts/b082d5c6-6d42-4cf4-b235-a51068f895a9/b082d5c6-6d42-4cf4-b235-a51068f895a9.jsonl';
const outPath = 'C:/Users/Farhan/Downloads/OMOF-best-prompting-startup-school.txt';

const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
const seen = new Set();
const picks = [];

const wantStarts = [
  '# OMOF MVP Build Prompt',
  'You are the lead product strategist',
  'You are the senior full-stack engineer for OMOF.\nBuild a moderation',
  "Users shouldn't be able to react",
  'You are building OMOF, a Firebase + Expo',
  'Build Instagram-style Activity for OMOF',
];

const titles = {
  '# OMOF MVP Build Prompt': 'Greenfield MVP — full product + stack spec',
  'You are the lead product strategist':
    'Vision gap analysis — audit first, evolve without rebuild',
  'You are the senior full-stack engineer for OMOF.\nBuild a moderation':
    'Moderation system — product philosophy + full implementation spec',
  "Users shouldn't be able to react":
    'Feature batch + user-side verification (connect back, growth, activity)',
  'You are building OMOF, a Firebase + Expo': 'Major feature expansion spec',
  'Build Instagram-style Activity for OMOF': 'Notifications / Activity tab spec',
};

for (const line of lines) {
  try {
    const o = JSON.parse(line);
    if (o.role !== 'user') continue;
    let q = o.message?.content?.find((c) => c.type === 'text')?.text || '';
    q = q.replace(/^<user_query>\n?/, '').replace(/\n?<\/user_query>$/, '').trim();
    for (const start of wantStarts) {
      if (q.startsWith(start) && !seen.has(start)) {
        seen.add(start);
        picks.push({ title: titles[start] ?? start.split('\n')[0], text: q });
      }
    }
  } catch {
    // skip malformed lines
  }
}

const intro = `OMOF — Best AI Prompting Samples
================================
Farhan Khan | Startup School Application
Project: OMOF (Opposite of FOMO) — authenticity-focused social platform
Source: Cursor AI pair-programming sessions building OMOF (2025–2026)

These prompts show how I use AI as a staff-level engineering partner:
- Product vision and constraints first
- Explicit "do NOT" rules to prevent wrong solutions
- Phased delivery and audit-before-build instructions
- End-to-end specs (UX + data model + backend + verification)

`;

const order = [
  '# OMOF MVP Build Prompt',
  'You are the lead product strategist',
  'You are the senior full-stack engineer for OMOF.\nBuild a moderation',
  "Users shouldn't be able to react",
  'Build Instagram-style Activity for OMOF',
  'You are building OMOF, a Firebase + Expo',
];

picks.sort((a, b) => {
  const ai = order.findIndex((k) => a.text.startsWith(k));
  const bi = order.findIndex((k) => b.text.startsWith(k));
  return ai - bi;
});

let body = intro;
picks.forEach((p, i) => {
  body += '\n\n' + '='.repeat(72) + '\n';
  body += `PROMPT ${i + 1}: ${p.title}\n`;
  body += '='.repeat(72) + '\n\n';
  body += p.text + '\n';
});

body += `\n\n${'='.repeat(72)}
APPENDIX: What these prompts produced
${'='.repeat(72)}

1. Greenfield MVP — Shipped cross-platform Expo app (iOS/Android/web) with auth,
   mood-tagged posts, support reactions, comments, follows, notifications, safety
   features, Firestore rules, and Cloud Functions.

2. Vision gap analysis — Shared Experiences (Discover), growth updates, support-first
   copy ("Your Circle", "Connections"), feed fairness — without rebuilding working code.

3. Moderation system — Six-outcome classifier (SAFE → SPAM), crisis support UX,
   reflection prompts, Cloud Functions, admin review queue, report escalation — designed
   to allow authentic struggle while blocking harm.

4. Feature batch — Comment replies, connect-back, activity badge fixes, growth update
   flow, pull-to-refresh, contact discovery — with explicit user-side verification.

5. Activity spec — Firestore notifications collection, Activity tab, push hooks.

6. Major features — Video uploads, promoted posts, expanded discovery.

Total file size intentionally small for application upload. Full build history available
in the OMOF repository and Cursor session transcripts.
`;

fs.writeFileSync(outPath, body, 'utf8');
const stat = fs.statSync(outPath);
console.log(`Written: ${outPath}`);
console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
console.log(`Prompts included: ${picks.length}`);
