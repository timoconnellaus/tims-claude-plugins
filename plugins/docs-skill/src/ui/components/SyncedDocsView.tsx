import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ParsedDoc, UserConfig } from "../types";

interface Props {
  docs: ParsedDoc[];
  config: UserConfig | null;
  onRefresh: () => void;
}

interface DocTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: DocTreeNode[];
  doc?: ParsedDoc;
}

function buildDocTree(docs: ParsedDoc[]): DocTreeNode[] {
  const root: DocTreeNode[] = [];

  const sortedDocs = [...docs].sort((a, b) =>
    a.frontmatter.topic.localeCompare(b.frontmatter.topic)
  );

  for (const doc of sortedDocs) {
    const parts = doc.frontmatter.topic.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existing = currentLevel.find((n) => n.name === part);

      if (!existing) {
        existing = {
          name: part,
          path: currentPath,
          isFolder: !isLast,
          children: [],
          doc: isLast ? doc : undefined,
        };
        currentLevel.push(existing);
      } else if (isLast) {
        existing.doc = doc;
      }

      currentLevel = existing.children;
    }
  }

  // Ensure nodes with children are marked as folders
  function fixFolderFlags(nodes: DocTreeNode[]) {
    for (const node of nodes) {
      if (node.children.length > 0) {
        node.isFolder = true;
      }
      fixFolderFlags(node.children);
    }
  }
  fixFolderFlags(root);

  return root;
}

function collectAllFolderPaths(nodes: DocTreeNode[]): string[] {
  const paths: string[] = [];
  const traverse = (node: DocTreeNode) => {
    if (node.isFolder) {
      paths.push(node.path);
      node.children.forEach(traverse);
    }
  };
  nodes.forEach(traverse);
  return paths;
}

function DocTreeNodeComponent({
  node,
  expanded,
  onExpand,
  selectedDoc,
  onSelectDoc,
  depth = 0,
}: {
  node: DocTreeNode;
  expanded: Set<string>;
  onExpand: (path: string) => void;
  selectedDoc: ParsedDoc | null;
  onSelectDoc: (doc: ParsedDoc) => void;
  depth?: number;
}) {
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedDoc?.path === node.doc?.path;

  return (
    <div>
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer ${
          isSelected
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        }`}
        style={{ paddingLeft: depth * 16 + 8 }}
        onClick={() => {
          if (node.doc) {
            onSelectDoc(node.doc);
          } else if (node.isFolder) {
            onExpand(node.path);
          }
        }}
      >
        {node.isFolder && node.children.length > 0 ? (
          <button
            className={`w-4 h-4 flex items-center justify-center ${
              isSelected ? "text-primary-foreground/70" : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onExpand(node.path);
            }}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <span className={`text-sm flex-1 truncate ${node.isFolder && !node.doc ? "font-medium" : ""}`}>
          {node.doc ? node.doc.frontmatter.title : node.name}
          {node.isFolder && !node.doc && "/"}
        </span>

        {node.doc && (
          <span
            className={`text-xs truncate ${
              isSelected ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {node.doc.lineCount} lines
          </span>
        )}
      </div>

      {node.isFolder && isExpanded && (
        <div>
          {node.children.map((child) => (
            <DocTreeNodeComponent
              key={child.path}
              node={child}
              expanded={expanded}
              onExpand={onExpand}
              selectedDoc={selectedDoc}
              onSelectDoc={onSelectDoc}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SyncedDocsView({ docs, config, onRefresh }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ParsedDoc | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const tree = useMemo(() => buildDocTree(docs), [docs]);

  const handlePull = async () => {
    setSyncing(true);
    try {
      await fetch("/api/pull", { method: "POST" });
      onRefresh();
    } catch (e) {
      console.error("Failed to pull:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleExpand = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex">
      {/* Left panel - Doc tree */}
      <div className="w-96 border-r bg-white flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Synced Documentation</h2>
            <p className="text-sm text-muted-foreground">
              {docs.length} docs in .docs/
            </p>
          </div>
          <Button onClick={handlePull} disabled={syncing} size="sm">
            {syncing ? "Syncing..." : "Pull Latest"}
          </Button>
        </div>

        {docs.length > 0 && (
          <div className="px-4 py-2 border-b flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(new Set(collectAllFolderPaths(tree)))}
            >
              Expand All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(new Set())}
            >
              Collapse All
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="py-2">
            {docs.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  No docs synced yet. Select topics and sync to get started.
                </p>
              </div>
            ) : (
              tree.map((node) => (
                <DocTreeNodeComponent
                  key={node.path}
                  node={node}
                  expanded={expanded}
                  onExpand={handleExpand}
                  selectedDoc={selectedDoc}
                  onSelectDoc={setSelectedDoc}
                />
              ))
            )}
          </div>
        </ScrollArea>

        {config?.lastSync && (
          <div className="p-4 border-t text-xs text-muted-foreground">
            Last synced: {new Date(config.lastSync).toLocaleString()}
          </div>
        )}
      </div>

      {/* Right panel - Doc preview */}
      <div className="flex-1 p-6 overflow-auto">
        {selectedDoc ? (
          <Card>
            <CardHeader>
              <CardTitle>{selectedDoc.frontmatter.title}</CardTitle>
              {selectedDoc.frontmatter.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedDoc.frontmatter.description}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Topic:</span>{" "}
                    <span className="font-mono">{selectedDoc.frontmatter.topic}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Path:</span>{" "}
                    <span className="font-mono">{selectedDoc.path}</span>
                  </div>
                  {selectedDoc.frontmatter.version && (
                    <div>
                      <span className="text-muted-foreground">Version:</span>{" "}
                      {selectedDoc.frontmatter.version}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Lines:</span>{" "}
                    {selectedDoc.lineCount}
                  </div>
                  {selectedDoc.frontmatter.sourceUrl && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Source:</span>{" "}
                      <a
                        href={selectedDoc.frontmatter.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {selectedDoc.frontmatter.sourceUrl}
                      </a>
                    </div>
                  )}
                </div>

                {selectedDoc.frontmatter.tags &&
                  selectedDoc.frontmatter.tags.length > 0 && (
                    <div>
                      <span className="text-sm text-muted-foreground">Tags:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedDoc.frontmatter.tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 bg-muted rounded text-xs"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Content Preview</h3>
                  <ScrollArea className="h-64">
                    <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-4 rounded">
                      {selectedDoc.content.slice(0, 2000)}
                      {selectedDoc.content.length > 2000 && "\n\n... (truncated)"}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Select a doc to view details
          </div>
        )}
      </div>
    </div>
  );
}
