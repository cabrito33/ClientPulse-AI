import type { ReportSection } from "@/data/types";

/**
 * Strips leading bullet markers (•, -, *, ◦, ▪) and excess whitespace from a line.
 */
export function cleanBullet(line: string): string {
  return line.replace(/^(\s*[-*•◦▪]\s*)+/, "").trim();
}

/** Parses a markdown-ish body back into the three mandatory blocks. */
export function parseBodyToSections(body: string): ReportSection | null {
  if (!body || typeof body !== "string") return null;

  const lines = body.split("\n");
  type SectionKey = "done" | "blocks" | "next" | null;
  let currentSection: SectionKey = null;

  const result: ReportSection = {
    done: [],
    blocks: [],
    next: [],
  };

  const isHeading = (line: string): SectionKey | false => {
    const trimmed = line.trim();
    if (!trimmed.startsWith("#")) return false;
    const lower = trimmed.toLowerCase();

    // Check Done section
    if (lower.includes("o que foi feito") || lower.includes("concluído") || lower.includes("feito")) {
      return "done";
    }
    // Check Blocks section (e.g. "## Bloqueios e pontos de atenção", "## Bloqueios")
    if (lower.includes("bloqueio") || lower.includes("impedimento") || (lower.includes("ponto") && lower.includes("atenção"))) {
      return "blocks";
    }
    // Check Next section (e.g. "## Próximos passos e decisões", "## Próximos passos")
    if (lower.includes("próximo") || lower.includes("proximo") || lower.includes("passo") || lower.includes("decis")) {
      return "next";
    }
    return false;
  };

  for (const line of lines) {
    const headingType = isHeading(line);
    if (headingType !== false) {
      currentSection = headingType;
      continue; // Consume the entire heading line cleanly without leaving remnants
    }

    if (!currentSection) continue;

    const trimmed = line.trim();
    if (!trimmed) continue; // Ignore empty lines

    // Ignore placeholder "(sem registos)" or "(nenhum)"
    if (/^\(?sem registos\)?$/i.test(trimmed) || /^\(?nenhum\)?$/i.test(trimmed)) {
      continue;
    }

    // Clean bullet marker(s) from the item
    const cleaned = cleanBullet(trimmed);
    if (cleaned) {
      result[currentSection].push(cleaned);
    }
  }

  if (result.done.length + result.blocks.length + result.next.length === 0) {
    return null;
  }
  return result;
}
