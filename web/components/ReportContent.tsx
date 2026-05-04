import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { slugify } from "@/lib/data/reportParser";

function nodeToText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeToText).join("");
  if (typeof node === "object" && "props" in (node as { props?: unknown }) ) {
    const props = (node as { props?: { children?: React.ReactNode } }).props;
    return nodeToText(props?.children);
  }
  return "";
}

const components: Components = {
  h2({ children }) {
    const text = nodeToText(children).trim();
    const coded = text.match(/^([A-Z])\)\s*(.+)$/);
    if (coded) {
      const id = slugify(`${coded[1]}-${coded[2]}`);
      return (
        <h2 id={id} className="rc-h2 rc-h2-coded">
          <span className="rc-h2-code" aria-hidden="true">{coded[1]}</span>
          <span className="rc-h2-title">{coded[2]}</span>
        </h2>
      );
    }
    const id = slugify(text);
    return (
      <h2 id={id} className="rc-h2">
        <span className="rc-h2-mark" aria-hidden="true" />
        <span className="rc-h2-title">{text}</span>
      </h2>
    );
  },
  h3({ children }) {
    return <h3 className="rc-h3">{children}</h3>;
  },
  h4({ children }) {
    return <h4 className="rc-h4">{children}</h4>;
  },
  p({ children }) {
    return <p className="rc-p">{children}</p>;
  },
  a({ href, children }) {
    const isExternal = typeof href === "string" && /^https?:\/\//.test(href);
    return (
      <a
        href={href}
        className="rc-a"
        {...(isExternal ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  ul({ children }) {
    return <ul className="rc-ul">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="rc-ol">{children}</ol>;
  },
  li({ children }) {
    return <li className="rc-li">{children}</li>;
  },
  blockquote({ children }) {
    return <blockquote className="rc-quote">{children}</blockquote>;
  },
  code({ children, className }) {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) return <code className={`rc-code-block ${className}`}>{children}</code>;
    return <code className="rc-code">{children}</code>;
  },
  pre({ children }) {
    return <pre className="rc-pre">{children}</pre>;
  },
  hr() {
    return <hr className="rc-hr" />;
  },
  table({ children }) {
    return (
      <div className="rc-table-wrap">
        <table className="rc-table">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="rc-thead">{children}</thead>;
  },
  tbody({ children }) {
    return <tbody className="rc-tbody">{children}</tbody>;
  },
  tr({ children }) {
    return <tr className="rc-tr">{children}</tr>;
  },
  th({ children }) {
    return <th className="rc-th">{children}</th>;
  },
  td({ children }) {
    const text = nodeToText(children).trim();
    const numeric =
      /^-?\$?[\d.,]+\s*(?:\/\s*\d+)?$/.test(text) ||
      /^[\d.,]+%$/.test(text) ||
      /^[\d.,]+\s*[Kk]$/.test(text);
    return (
      <td className={`rc-td${numeric ? " rc-td-num" : ""}`} data-text={text || undefined}>
        {children}
      </td>
    );
  },
  strong({ children }) {
    return <strong className="rc-strong">{children}</strong>;
  },
  em({ children }) {
    return <em className="rc-em">{children}</em>;
  },
};

export function ReportContent({ body }: { body: string }) {
  return (
    <article className="report-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {body}
      </ReactMarkdown>
    </article>
  );
}
