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

for (const line of lines) {
  try {
    const o = JSON.parse(line);
    if (o.role !== 'user') continue;
    let q = o.message?.content?.find((c) => c.type === 'text')?.text || '';
    q = q.replace(/^<user_query>\n?/, '').replace(/\n?<\/user_query>$/, '').trim();
    for (const start of wantStarts) {
      if (q.startsWith(start) && !seen.has(start)) {
        seen.add(start);
        picks.push({ title: start.split('\n')[0], text: q });
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

let body = intro;
picks.forEach((p, i) => {
  body += '\n\n' + '='.repeat(72) + '\n';
  body += `PROMPT ${i + 1}: ${p.title}\n`;
  body += '='.repeat(72) + '\n\n';
  body += p.text + '\n';
});

fs.writeFileSync(outPath, body, 'utf8');
const stat = fs.statSync(outPath);
console.log(`Written: ${outPath}`);
console.log(`Size: ${(stat.size / 1024).toFixed(1)} KB`);
console.log(`Prompts included: ${picks.length}`);
