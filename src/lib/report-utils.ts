import type { ReportSection } from "@/data/types";

/** Parses a markdown-ish body back into the three mandatory blocks. */
export function parseBodyToSections(body: string): ReportSection | null {
  const grab = (heading: string, nextHeading?: string): string[] => {
    const start = body.indexOf(heading);
    if (start === -1) return [];
    const after = body.slice(start + heading.length);
    const end = nextHeading ? after.indexOf(nextHeading) : -1;
    const chunk = end === -1 ? after : after.slice(0, end);
    return chunk
      .split("\n")
      .map((l) => l.replace(/^\s*[-*]\s*/, "").trim())
      .filter(Boolean);
  };
  const done = grab("## O que foi feito", "## Bloqueios");
  const blocks = grab("## Bloqueios", "## Próximos passos");
  const next = grab("## Próximos passos");
  if (done.length + blocks.length + next.length === 0) return null;
  return { done, blocks, next };
}
