import fs from 'node:fs';
import path from 'node:path';

function markdownFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? markdownFiles(file) : file.endsWith('.md') ? [file] : [];
  });
}
function anchors(text) {
  const seen = new Map();
  return new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map(([, title]) => {
    const slug = title.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    return count ? `${slug}-${count}` : slug;
  }));
}
let checked = 0;
const errors = [];
for (const file of ['README.md', ...markdownFiles('docs')]) {
  const source = fs.readFileSync(file, 'utf8').replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');
  for (const [, raw] of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const link = raw.replace(/^<|>$/g, '');
    if (/^(https?:|mailto:|data:)/i.test(link)) continue;
    const [target, fragment] = link.split('#');
    const resolved = target ? path.resolve(path.dirname(file), decodeURIComponent(target)) : path.resolve(file);
    checked++;
    if (!fs.existsSync(resolved)) errors.push(`${file}: missing ${link}`);
    else if (fragment && resolved.endsWith('.md') && !anchors(fs.readFileSync(resolved, 'utf8')).has(decodeURIComponent(fragment))) {
      errors.push(`${file}: missing anchor ${link}`);
    }
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log(`Documentation: ${checked} local links and anchors verified.`);
