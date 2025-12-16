

import * as React from "react"
import ReactMarkdown from "react-markdown"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism"
import { cn } from "../lib/utils"
import { Button } from "../shadcn/button"
import { Copy, Check } from "lucide-react"
import type { MessageBubbleProps } from "./types"

export function ChatMessage({
  message,
  className,
  showTimestamp = false,
  showMetadata = false,
}: MessageBubbleProps) {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null)
  const isUser = message.role === "user"

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const formatTimestamp = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date))
  }

  // User messages - styled to stand out
  if (isUser) {
    return (
      <div className={cn("px-4 py-3 bg-muted/50 border-l-2 border-violet-600", className)}>
        <p className="text-sm text-foreground font-medium whitespace-pre-wrap break-words">
          {message.content}
        </p>
      </div>
    )
  }

  // Assistant messages - left-aligned, no bubble
  return (
    <div className={cn("px-4 py-2", className)}>
      <div className="text-xs">
        {/* Render markdown content */}
        <ReactMarkdown
          components={{
            // Paragraphs with proper spacing
            p({ children }) {
              return <p className="text-foreground/80 mb-2 last:mb-0 leading-normal">{children}</p>
            },
            // Bold text
            strong({ children }) {
              return <strong className="font-bold text-foreground">{children}</strong>
            },
            // Italic text
            em({ children }) {
              return <em className="italic">{children}</em>
            },
            // Unordered lists
            ul({ children }) {
              return <ul className="text-foreground/80 mb-2 last:mb-0 space-y-0.5 list-none">{children}</ul>
            },
            // Ordered lists
            ol({ children }) {
              return <ol className="text-foreground/80 mb-2 last:mb-0 space-y-0.5 list-decimal list-inside">{children}</ol>
            },
            // List items
            li({ children }) {
              return <li className="leading-normal">- {children}</li>
            },
            // Headings
            h1({ children }) {
              return <h1 className="text-sm font-semibold text-foreground mb-1.5 mt-3 first:mt-0">{children}</h1>
            },
            h2({ children }) {
              return <h2 className="text-xs font-semibold text-foreground mb-1.5 mt-2 first:mt-0">{children}</h2>
            },
            h3({ children }) {
              return <h3 className="text-xs font-semibold text-foreground mb-1 mt-2 first:mt-0">{children}</h3>
            },
            // Links
            a({ href, children }) {
              return (
                <a
                  href={href}
                  className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              )
            },
            // Blockquotes
            blockquote({ children }) {
              return (
                <blockquote className="border-l-2 border-muted-foreground/30 pl-4 my-3 text-muted-foreground/80 italic">
                  {children}
                </blockquote>
              )
            },
            // Horizontal rules
            hr() {
              return <hr className="my-4 border-muted-foreground/20" />
            },
            // Code blocks and inline code
            code(props) {
              const { className, children } = props
              const match = /language-(\w+)/.exec(className || "")
              const codeId = `${message.id}-${Math.random()}`
              const codeString = String(children).replace(/\n$/, "")
              const isMultiline = codeString.includes('\n') || match

              return isMultiline ? (
                <div className="relative group/code my-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-2 top-2 h-6 w-6 opacity-0 group-hover/code:opacity-100 transition-opacity z-10"
                    onClick={() => copyToClipboard(codeString, codeId)}
                  >
                    {copiedCode === codeId ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <SyntaxHighlighter
                    style={oneDark as any}
                    language={match?.[1] || 'text'}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: '0.375rem',
                      fontSize: '0.6875rem',
                    }}
                  >
                    {codeString}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code className="text-violet-600 font-mono text-[0.6875rem]">
                  {children}
                </code>
              )
            },
            // Pre blocks (wrapper for code blocks)
            pre({ children }) {
              return <>{children}</>
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {/* Timestamp and Metadata */}
      {(showTimestamp || showMetadata) && (
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground/70">
          {showTimestamp && (
            <span>{formatTimestamp(message.timestamp)}</span>
          )}
          {showMetadata && message.metadata && (
            <>
              {message.metadata.model && (
                <span>{message.metadata.model}</span>
              )}
              {message.metadata.tokens && (
                <span>{message.metadata.tokens} tokens</span>
              )}
              {message.metadata.duration_ms && (
                <span>
                  {(message.metadata.duration_ms / 1000).toFixed(2)}s
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
