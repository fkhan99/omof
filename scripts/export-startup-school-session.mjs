import fs from 'fs';
import path from 'path';

const transcriptPath =
  'C:/Users/Farhan/.cursor/projects/c-Users-Farhan-Projects-omof/agent-transcripts/b082d5c6-6d42-4cf4-b235-a51068f895a9/b082d5c6-6d42-4cf4-b235-a51068f895a9.jsonl';
const outPath = 'C:/Users/Farhan/Downloads/OMOF-coding-agent-session-startup-school.txt';
const MAX_BYTES = 14 * 1024 * 1024; // stay under 15 MB

function stripUserQuery(raw) {
  return raw.replace(/^<user_query>\n?/, '').replace(/\n?<\/user_query>$/, '').trim();
}

function summarizeToolUse(block) {
  const name = block.name ?? 'unknown';
  const input = block.input ?? {};
  if (name === 'Write' && input.path) {
    return `  • Created ${path.basename(String(input.path))}`;
  }
  if (name === 'StrReplace' && input.path) {
    return `  • Edited ${path.basename(String(input.path))}`;
  }
  if (name === 'Read' && input.path) {
    return `  • Read ${path.basename(String(input.path))}`;
  }
  if (name === 'Shell' && input.command) {
    const cmd = String(input.command).replace(/\s+/g, ' ').slice(0, 100);
    return `  • Ran: ${cmd}${cmd.length >= 100 ? '…' : ''}`;
  }
  if (name === 'Task') {
    return `  • Explored codebase: ${input.description ?? 'subagent task'}`;
  }
  if (name === 'Grep' || name === 'Glob' || name === 'SemanticSearch') {
    return `  • Searched codebase (${name})`;
  }
  if (name === 'TodoWrite') {
    return `  • Updated task list`;
  }
  return `  • ${name}`;
}

function formatAssistantContent(content) {
  const parts = [];
  const actions = [];

  for (const block of content ?? []) {
    if (block.type === 'text' && block.text?.trim()) {
      let text = block.text.trim();
      // Already redacted in source transcripts — keep as-is
      parts.push(text);
    }
    if (block.type === 'tool_use') {
      actions.push(summarizeToolUse(block));
    }
  }

  let out = parts.join('\n\n');
  if (actions.length > 0) {
    const unique = [...new Set(actions)];
    const shown = unique.slice(0, 40);
    out += `\n\n[Agent actions this step (${actions.length} total)]\n${shown.join('\n')}`;
    if (unique.length > 40) {
      out += `\n  • … and ${unique.length - 40} more actions`;
    }
  }
  return out.trim();
}

function parseTranscript(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  const turns = [];
  let current = null;

  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }

    if (row.role === 'user') {
      if (current) turns.push(current);
      const text = row.message?.content?.find((c) => c.type === 'text')?.text ?? '';
      current = {
        user: stripUserQuery(text),
        assistantParts: [],
      };
      continue;
    }

    if (row.role === 'assistant' && current) {
      const formatted = formatAssistantContent(row.message?.content);
      if (formatted) current.assistantParts.push(formatted);
    }
  }

  if (current) turns.push(current);
  return turns;
}

const intro = `OMOF — Coding Agent Session (Full Back-and-Forth)
=====================================================
Farhan Khan | Y Combinator Startup School Application
Project: OMOF — "Opposite of FOMO" (authenticity-focused social platform)
Tool: Cursor AI agent (Claude) pair-programming on a real production codebase

WHY THIS SESSION
----------------
This is a real build session for OMOF — not a toy demo. Over multiple turns I used
AI as a staff-level engineering partner to:

  • Spec and ship a cross-platform social app (Expo + Firebase)
  • Evolve product vision without rebuilding working features
  • Debug production issues (auth, notifications, growth updates, TanStack Query)
  • Design and implement a moderation system that allows authentic struggle while
    blocking harm — aligned with OMOF's mission

WHAT YOU'RE READING
-------------------
Each TURN shows:
  1. My prompt (USER)
  2. The agent's reply (ASSISTANT) — explanations, decisions, summaries
  3. [Agent actions] — files created/edited, commands run, codebase searches
     (tool payloads are summarized so this file stays readable and under 15 MB)

The conversation is chronological. Later turns assume earlier work (same repo).

`;

const turns = parseTranscript(transcriptPath);
let body = intro;
body += `\nTotal turns: ${turns.length}\n`;
body += `${'═'.repeat(72)}\n\n`;

let turnNum = 0;
for (const turn of turns) {
  turnNum += 1;
  const header = `\n${'═'.repeat(72)}\nTURN ${turnNum} — USER\n${'═'.repeat(72)}\n\n`;
  const userBlock = turn.user || '(empty message)';
  const assistantBlock = turn.assistantParts.length
    ? turn.assistantParts.join('\n\n---\n\n')
    : '(no assistant text captured for this turn)';

  const chunk =
    header +
    userBlock +
    `\n\n${'─'.repeat(72)}\nTURN ${turnNum} — ASSISTANT\n${'─'.repeat(72)}\n\n` +
    assistantBlock +
    '\n';

  if (Buffer.byteLength(body + chunk, 'utf8') > MAX_BYTES) {
    body += `\n${'═'.repeat(72)}\n[Export truncated at turn ${turnNum} to stay under 15 MB upload limit.]\n`;
    break;
  }
  body += chunk;
}

body += `\n${'═'.repeat(72)}\nEND OF SESSION EXPORT\n${'═'.repeat(72)}\n`;

fs.writeFileSync(outPath, body, 'utf8');
const stat = fs.statSync(outPath);
console.log(`Written: ${outPath}`);
console.log(`Size: ${(stat.size / 1024 / 1024).toFixed(2)} MB (${stat.size} bytes)`);
console.log(`Turns exported: ${turnNum} / ${turns.length}`);
