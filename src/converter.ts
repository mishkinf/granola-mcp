import type {
  ProseMirrorDoc,
  ProseMirrorNode,
  TranscriptUtterance,
} from "./api.js";

export function proseMirrorToMarkdown(doc: ProseMirrorDoc | undefined): string {
  if (!doc || !doc.content) {
    return "";
  }

  return processNodes(doc.content);
}

function processNodes(nodes: ProseMirrorNode[]): string {
  return nodes.map(processNode).join("");
}

function processNode(node: ProseMirrorNode): string {
  switch (node.type) {
    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const text = node.content ? processNodes(node.content) : "";
      return `${"#".repeat(level)} ${text}\n\n`;
    }

    case "paragraph": {
      const text = node.content ? processNodes(node.content) : "";
      return `${text}\n\n`;
    }

    case "bulletList": {
      if (!node.content) return "";
      const items = node.content
        .filter((item) => item.type === "listItem")
        .map((item) => {
          const text = item.content ? processNodes(item.content).trim() : "";
          return `- ${text}`;
        });
      return items.join("\n") + "\n\n";
    }

    case "orderedList": {
      if (!node.content) return "";
      const items = node.content
        .filter((item) => item.type === "listItem")
        .map((item, index) => {
          const text = item.content ? processNodes(item.content).trim() : "";
          return `${index + 1}. ${text}`;
        });
      return items.join("\n") + "\n\n";
    }

    case "listItem": {
      return node.content ? processNodes(node.content) : "";
    }

    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = node.content ? processNodes(node.content) : "";
      return `\`\`\`${lang}\n${code}\`\`\`\n\n`;
    }

    case "blockquote": {
      const text = node.content ? processNodes(node.content) : "";
      return text
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n") + "\n\n";
    }

    case "horizontalRule":
      return "---\n\n";

    case "hardBreak":
      return "\n";

    case "text": {
      let text = node.text ?? "";
      // Handle marks (bold, italic, etc.) if present
      const marks = (node as unknown as { marks?: { type: string }[] }).marks;
      if (marks) {
        for (const mark of marks) {
          switch (mark.type) {
            case "bold":
            case "strong":
              text = `**${text}**`;
              break;
            case "italic":
            case "em":
              text = `*${text}*`;
              break;
            case "code":
              text = `\`${text}\``;
              break;
            case "strike":
              text = `~~${text}~~`;
              break;
          }
        }
      }
      return text;
    }

    default:
      // Recursively process unknown nodes that might have content
      if (node.content) {
        return processNodes(node.content);
      }
      return "";
  }
}

export function transcriptToMarkdown(
  utterances: TranscriptUtterance[]
): string {
  if (!utterances || utterances.length === 0) {
    return "";
  }

  const lines: string[] = ["# Transcript\n"];

  for (const utterance of utterances) {
    const time = new Date(utterance.start_timestamp).toLocaleTimeString();
    const source = utterance.source === "microphone" ? "🎤" : "💻";
    lines.push(`**[${time}]** ${source} ${utterance.text}\n`);
  }

  return lines.join("\n");
}

export function transcriptToPlainText(
  utterances: TranscriptUtterance[]
): string {
  if (!utterances || utterances.length === 0) {
    return "";
  }

  return utterances.map((u) => u.text).join(" ");
}

/**
 * Converts transcript to speaker-attributed format for AI processing.
 * Uses [ME] for microphone (the user) and [PARTICIPANT] for system audio (others).
 */
export function transcriptWithSpeakers(
  utterances: TranscriptUtterance[]
): string {
  if (!utterances || utterances.length === 0) {
    return "";
  }

  const lines: string[] = [];
  let currentSpeaker: string | null = null;
  let currentTexts: string[] = [];

  // Merge consecutive utterances from the same speaker
  for (const utterance of utterances) {
    const speaker = utterance.source === "microphone" ? "[ME]" : "[PARTICIPANT]";

    if (speaker === currentSpeaker) {
      currentTexts.push(utterance.text);
    } else {
      // Flush previous speaker's text
      if (currentSpeaker && currentTexts.length > 0) {
        lines.push(`${currentSpeaker} ${currentTexts.join(" ")}`);
      }
      currentSpeaker = speaker;
      currentTexts = [utterance.text];
    }
  }

  // Flush final speaker's text
  if (currentSpeaker && currentTexts.length > 0) {
    lines.push(`${currentSpeaker} ${currentTexts.join(" ")}`);
  }

  return lines.join("\n\n");
}
