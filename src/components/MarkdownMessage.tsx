import type { ReactNode } from "react";

const INLINE_TOKEN = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;

function inlineContent(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;
  for (const match of text.matchAll(INLINE_TOKEN)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(text.slice(cursor, index));
    const token = match[0];
    const key = `${keyPrefix}-${tokenIndex++}`;
    if (token.startsWith("[")) {
      const parsed = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (parsed) {
        nodes.push(<a key={key} href={parsed[2]} target="_blank" rel="noopener noreferrer">{parsed[1]}</a>);
      }
    } else if (token.startsWith("`")) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    cursor = index + token.length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

export default function MarkdownMessage({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let codeLines: string[] | null = null;
  let codeLanguage = "";
  let key = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(<p key={`p-${key++}`}>{paragraph.map((line, index) => (
      <span key={index}>{index > 0 && <br />}{inlineContent(line, `p-${key}-${index}`)}</span>
    ))}</p>);
    paragraph = [];
  };

  for (const line of lines) {
    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      if (codeLines) {
        blocks.push(
          <div className="markdown-code" key={`code-${key++}`}>
            {codeLanguage && <div className="markdown-code-label">{codeLanguage}</div>}
            <pre><code>{codeLines.join("\n")}</code></pre>
          </div>,
        );
        codeLines = null;
        codeLanguage = "";
      } else {
        flushParagraph();
        codeLines = [];
        codeLanguage = fence[1].trim();
      }
      continue;
    }
    if (codeLines) {
      codeLines.push(line);
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const listItem = line.match(/^\s*[-*]\s+(.+)$/);
    const numberedItem = line.match(/^\s*\d+\.\s+(.+)$/);
    if (!line.trim()) {
      flushParagraph();
    } else if (heading) {
      flushParagraph();
      const Heading = `h${heading[1].length + 2}` as "h3" | "h4" | "h5";
      blocks.push(<Heading key={`h-${key++}`}>{inlineContent(heading[2], `h-${key}`)}</Heading>);
    } else if (listItem || numberedItem) {
      flushParagraph();
      blocks.push(<div className="markdown-list-item" key={`li-${key++}`}>• {inlineContent((listItem || numberedItem)![1], `li-${key}`)}</div>);
    } else {
      paragraph.push(line);
    }
  }
  if (codeLines) {
    blocks.push(
      <div className="markdown-code" key={`code-${key++}`}>
        {codeLanguage && <div className="markdown-code-label">{codeLanguage}</div>}
        <pre><code>{codeLines.join("\n")}</code></pre>
      </div>,
    );
  }
  flushParagraph();
  return <div className="markdown-message">{blocks}</div>;
}
