import * as React from "react";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "../lib/utils";
import { Button } from "../shadcn/button";
import { ScrollArea } from "../shadcn/scroll-area";
import { Copy, Check, ChevronLeft, Book, FileText, Cpu, Terminal, Cog } from "lucide-react";

interface DocPage {
  slug: string;
  title: string;
  icon: React.ReactNode;
}

const DOC_PAGES: DocPage[] = [
  { slug: "index", title: "Overview", icon: <Book className="h-4 w-4" /> },
  { slug: "usage-guide", title: "Usage Guide", icon: <FileText className="h-4 w-4" /> },
  { slug: "cli-reference", title: "CLI Reference", icon: <Terminal className="h-4 w-4" /> },
  { slug: "architecture", title: "Architecture", icon: <Cpu className="h-4 w-4" /> },
  { slug: "how-it-works", title: "How It Works", icon: <Cog className="h-4 w-4" /> },
];

interface DocsViewerProps {
  content: string;
  currentPage: string;
  onNavigate: (page: string) => void;
  onClose: () => void;
  className?: string;
}

export function DocsViewer({
  content,
  currentPage,
  onNavigate,
  onClose,
  className,
}: DocsViewerProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Scroll to top when page changes
  React.useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
  }, [currentPage]);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Handle internal doc links
  const handleLinkClick = (href: string) => {
    // Check if it's an internal doc link (just a slug like "usage-guide")
    const isInternalLink = DOC_PAGES.some((p) => p.slug === href);
    if (isInternalLink) {
      onNavigate(href);
      return true;
    }
    return false;
  };

  return (
    <div className={cn("flex h-full", className)}>
      {/* Sidebar */}
      <div className="w-56 flex-none border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="flex-none px-3 py-3 border-b border-gray-200">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="w-full justify-start text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Requirements
          </Button>
        </div>
        <nav className="flex-1 p-3">
          <div className="space-y-1">
            {DOC_PAGES.map((page) => (
              <button
                key={page.slug}
                onClick={() => onNavigate(page.slug)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                  currentPage === page.slug
                    ? "bg-violet-100 text-violet-900 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                {page.icon}
                {page.title}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Content */}
      <ScrollArea ref={contentRef} className="flex-1">
        <div className="max-w-3xl mx-auto px-8 py-8">
          <article className="prose prose-gray prose-sm max-w-none">
            <ReactMarkdown
              components={{
                // Paragraphs
                p({ children }) {
                  return (
                    <p className="text-gray-700 mb-4 leading-relaxed">
                      {children}
                    </p>
                  );
                },
                // Bold
                strong({ children }) {
                  return (
                    <strong className="font-semibold text-gray-900">
                      {children}
                    </strong>
                  );
                },
                // Italic
                em({ children }) {
                  return <em className="italic">{children}</em>;
                },
                // Unordered lists
                ul({ children }) {
                  return (
                    <ul className="text-gray-700 mb-4 space-y-1 list-disc list-inside">
                      {children}
                    </ul>
                  );
                },
                // Ordered lists
                ol({ children }) {
                  return (
                    <ol className="text-gray-700 mb-4 space-y-1 list-decimal list-inside">
                      {children}
                    </ol>
                  );
                },
                // List items
                li({ children }) {
                  return <li className="leading-relaxed">{children}</li>;
                },
                // Headings
                h1({ children }) {
                  return (
                    <h1 className="text-2xl font-bold text-gray-900 mb-4 mt-8 first:mt-0 pb-2 border-b border-gray-200">
                      {children}
                    </h1>
                  );
                },
                h2({ children }) {
                  return (
                    <h2 className="text-xl font-semibold text-gray-900 mb-3 mt-8 first:mt-0">
                      {children}
                    </h2>
                  );
                },
                h3({ children }) {
                  return (
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 mt-6 first:mt-0">
                      {children}
                    </h3>
                  );
                },
                h4({ children }) {
                  return (
                    <h4 className="text-base font-semibold text-gray-900 mb-2 mt-4 first:mt-0">
                      {children}
                    </h4>
                  );
                },
                // Links
                a({ href, children }) {
                  const isInternal = href && DOC_PAGES.some((p) => p.slug === href);
                  if (isInternal && href) {
                    return (
                      <button
                        onClick={() => handleLinkClick(href)}
                        className="text-violet-600 hover:text-violet-800 underline underline-offset-2 font-medium"
                      >
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a
                      href={href}
                      className="text-violet-600 hover:text-violet-800 underline underline-offset-2"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  );
                },
                // Blockquotes
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-4 border-violet-300 bg-violet-50 pl-4 pr-4 py-2 my-4 text-gray-700 italic rounded-r">
                      {children}
                    </blockquote>
                  );
                },
                // Horizontal rules
                hr() {
                  return <hr className="my-8 border-gray-200" />;
                },
                // Tables
                table({ children }) {
                  return (
                    <div className="overflow-x-auto my-4">
                      <table className="min-w-full divide-y divide-gray-200 border border-gray-200 rounded-lg">
                        {children}
                      </table>
                    </div>
                  );
                },
                thead({ children }) {
                  return <thead className="bg-gray-50">{children}</thead>;
                },
                th({ children }) {
                  return (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="px-4 py-2 text-sm text-gray-700 border-t border-gray-100">
                      {children}
                    </td>
                  );
                },
                // Code blocks and inline code
                code(props) {
                  const { className, children } = props;
                  const match = /language-(\w+)/.exec(className || "");
                  const codeId = `doc-${Math.random().toString(36).slice(2)}`;
                  const codeString = String(children).replace(/\n$/, "");
                  const isMultiline = codeString.includes("\n") || match;

                  return isMultiline ? (
                    <div className="relative group/code my-4">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="absolute right-2 top-2 h-7 w-7 opacity-0 group-hover/code:opacity-100 transition-opacity z-10 bg-gray-700 hover:bg-gray-600"
                        onClick={() => copyToClipboard(codeString, codeId)}
                      >
                        {copiedCode === codeId ? (
                          <Check className="h-3.5 w-3.5 text-green-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-gray-300" />
                        )}
                      </Button>
                      <SyntaxHighlighter
                        style={oneDark as any}
                        language={match?.[1] || "text"}
                        PreTag="div"
                        customStyle={{
                          margin: 0,
                          borderRadius: "0.5rem",
                          fontSize: "0.8125rem",
                          lineHeight: "1.5",
                        }}
                      >
                        {codeString}
                      </SyntaxHighlighter>
                    </div>
                  ) : (
                    <code className="text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded text-sm font-mono">
                      {children}
                    </code>
                  );
                },
                // Pre blocks (wrapper for code blocks)
                pre({ children }) {
                  return <>{children}</>;
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        </div>
      </ScrollArea>
    </div>
  );
}
