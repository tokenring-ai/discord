import getRandomItem from "@tokenring-ai/utility/string/getRandomItem";
import workingMessages from "@tokenring-ai/utility/string/workingMessages";

const MAX = 1990;

export function splitIntoChunks(text: string | null): string[] {
  if (!text) {
    return [`***${getRandomItem(workingMessages)}... ⏳***`];
  }

  const sections = text.split(/(?=\n#)/);
  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    if (current.length + section.length > MAX) {
      if (current) chunks.push(current);
      current = section;
    } else {
      current += section;
    }
  }

  if (current) chunks.push(current);

  return chunks.flatMap(chunk => {
    const parts: string[] = [];
    let remaining = chunk;

    while (remaining.length > MAX) {
      parts.push(remaining.substring(0, MAX));
      remaining = remaining.substring(MAX);
    }

    if (remaining) parts.push(remaining);
    return parts;
  });
}
