#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

let data = '';
process.stdin.on('data', (c) => (data += c));
process.stdin.on('end', () => {
  let input;
  try { input = JSON.parse(data); } catch { return; }

  const toolInput = input.tool_input || {};
  const filePath = toolInput.file_path || (input.tool_response && input.tool_response.filePath);
  if (!filePath) return;

  const root = process.cwd();
  const abs = path.resolve(root, filePath);
  if (!abs.startsWith(root + path.sep) && abs !== root) return;
  let rel = path.relative(root, abs);
  rel = rel.split(path.sep).join('/');

  const pendingFile = path.join(root, '.claude', '.pending-review');
  fs.mkdirSync(path.dirname(pendingFile), { recursive: true });
  const existing = fs.existsSync(pendingFile) ? fs.readFileSync(pendingFile, 'utf8') : '';
  const lines = new Set(existing.split('\n').filter(Boolean));
  lines.add(rel);
  fs.writeFileSync(pendingFile, Array.from(lines).join('\n') + '\n');
});
