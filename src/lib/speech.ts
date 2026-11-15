/**
 * ==============================================================================
 * ClientPulse AI — Speech Recognition & Transcript Processing Utilities (FE-10)
 * File: src/lib/speech.ts
 *
 * Provides pure, testable utilities to extract, clean, fold, deduplicate,
 * and merge Web Speech API transcripts (handling Android cumulative events,
 * consecutive phrase repetitions, and pre-existing input text).
 * ==============================================================================
 */

/**
 * Normalizes text for comparison by collapsing whitespace,
 * converting to lower case, and stripping surrounding/trailing punctuation.
 */
export function normalizeForComparison(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts raw transcript strings from any Web Speech API results object,
 * array of SpeechRecognitionResult items, array of strings, or custom mocks.
 */
export function extractRawSegments(results: unknown): string[] {
  if (!results) return [];

  if (typeof results === "string") {
    const trimmed = results.trim();
    return trimmed ? [trimmed] : [];
  }

  let list: unknown[] = [];
  if (Array.isArray(results)) {
    list = results;
  } else if (typeof results === "object" && results !== null && "length" in results) {
    list = Array.from(results as ArrayLike<unknown>);
  } else {
    return [];
  }

  const segments: string[] = [];

  for (const item of list) {
    if (!item) continue;

    let transcript = "";
    if (typeof item === "string") {
      transcript = item;
    } else if (typeof item === "object" && item !== null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyItem = item as any;
      if (anyItem[0] && typeof anyItem[0].transcript === "string") {
        transcript = anyItem[0].transcript;
      } else if (typeof anyItem.transcript === "string") {
        transcript = anyItem.transcript;
      } else if (typeof anyItem[0] === "string") {
        transcript = anyItem[0];
      }
    }

    const trimmed = transcript.trim();
    if (trimmed) {
      segments.push(trimmed);
    }
  }

  return segments;
}

/**
 * Folds accumulated or duplicated segments delivered by mobile/Android browsers.
 * If segment[i+1] begins with segment[i] (cumulative accumulation), segment[i] is superseded.
 * If segment[i+1] is identical to segment[i], the duplicate is discarded.
 */
export function foldAccumulatedSegments(segments: string[]): string[] {
  if (!segments || segments.length <= 1) return segments || [];

  const result: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const current = segments[i].trim();
    if (!current) continue;

    if (result.length === 0) {
      result.push(current);
      continue;
    }

    const prevIndex = result.length - 1;
    const prev = result[prevIndex];
    const prevNorm = normalizeForComparison(prev);
    const currNorm = normalizeForComparison(current);

    // Exact duplicate consecutive segment
    if (prevNorm === currNorm) {
      continue;
    }

    // Android accumulation: current segment begins with previous segment
    // (e.g. prev="como funciona", current="como funciona o client pulse ai")
    if (
      currNorm.startsWith(prevNorm) &&
      (currNorm.length === prevNorm.length || currNorm[prevNorm.length] === " ")
    ) {
      result[prevIndex] = current;
      continue;
    }

    result.push(current);
  }

  return result;
}

/**
 * Deduplicates consecutive exact or normalized phrase repetitions in text.
 * Covers:
 * 1. The whole text being repeated N times (e.g. "como funciona o client pulse ai como funciona o client pulse ai")
 * 2. Sliding window consecutive phrase repetitions (e.g. "olá como funciona como funciona o projeto")
 * 3. Consecutive identical words across whole utterance or adjacent
 */
export function deduplicateConsecutivePhrases(text: string): string {
  if (!text || typeof text !== "string") return "";

  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";

  const words = trimmed.split(" ");
  if (words.length <= 1) {
    return trimmed;
  }

  // 1. Check if the ENTIRE sequence of words is composed of a phrase repeated k times (k >= 2)
  for (let m = 1; m <= Math.floor(words.length / 2); m++) {
    if (words.length % m === 0) {
      const k = words.length / m;
      const firstChunkNorm = words.slice(0, m).map(normalizeForComparison).join(" ");
      let allMatch = true;

      for (let j = 1; j < k; j++) {
        const chunkNorm = words.slice(j * m, (j + 1) * m).map(normalizeForComparison).join(" ");
        if (chunkNorm !== firstChunkNorm) {
          allMatch = false;
          break;
        }
      }

      if (allMatch) {
        return words.slice(0, m).join(" ");
      }
    }
  }

  // 2. Sliding window for consecutive phrase repetitions within the word list
  // Prefer longer repeated phrases first (m >= 2)
  const resultWords = [...words];
  let i = 0;
  while (i < resultWords.length) {
    let matched = false;
    const maxM = Math.floor((resultWords.length - i) / 2);
    for (let m = maxM; m >= 2; m--) {
      const phrase1 = resultWords.slice(i, i + m).map(normalizeForComparison).join(" ");
      const phrase2 = resultWords.slice(i + m, i + 2 * m).map(normalizeForComparison).join(" ");
      if (phrase1 && phrase1 === phrase2) {
        resultWords.splice(i + m, m);
        matched = true;
        break;
      }
    }
    if (!matched) {
      i++;
    }
  }

  // 3. Deduplicate single repeated word if repeated consecutively and word length > 2
  const finalWords: string[] = [];
  for (let j = 0; j < resultWords.length; j++) {
    const current = resultWords[j];
    const prev = finalWords[finalWords.length - 1];
    if (
      prev &&
      normalizeForComparison(prev) === normalizeForComparison(current) &&
      normalizeForComparison(current).length > 2
    ) {
      continue;
    }
    finalWords.push(current);
  }

  return finalWords.join(" ");
}

/**
 * Combines pre-existing input text (baseText) with the cleaned dictated transcript.
 * - If baseText is empty, returns dictated text.
 * - If dictated text is empty, returns baseText.
 * - Ensures a single space between baseText and dictated text without extra spaces.
 */
export function combineVoiceTranscript(baseText: string, dictatedText: string): string {
  const cleanDictated = (dictatedText || "").trim();
  const cleanBase = (baseText || "").trim();

  if (!cleanDictated) {
    return cleanBase ? baseText : "";
  }

  if (!cleanBase) {
    return cleanDictated;
  }

  if (baseText.endsWith(" ") || baseText.endsWith("\n") || baseText.endsWith("\t")) {
    return `${baseText}${cleanDictated}`;
  }

  return `${baseText} ${cleanDictated}`;
}

/**
 * Extracts and cleans speech recognition results without merging base text.
 */
export function extractVoiceTranscript(results: unknown): string {
  const raw = extractRawSegments(results);
  const folded = foldAccumulatedSegments(raw);
  const joined = folded.join(" ");
  return deduplicateConsecutivePhrases(joined);
}

/**
 * Pure function to process speech recognition results and combine with baseText:
 * 1. Extracts all transcripts from event.results starting from index 0
 * 2. Folds Android cumulative results
 * 3. Joins with single space
 * 4. Deduplicates consecutive identical phrases/sentences
 * 5. Replaces dictated content cleanly against baseText (never appends onto previous dictated text)
 */
export function processVoiceTranscript(baseText: string, results: unknown): string {
  const transcript = extractVoiceTranscript(results);
  return combineVoiceTranscript(baseText, transcript);
}
