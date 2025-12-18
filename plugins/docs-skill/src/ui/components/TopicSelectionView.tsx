import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { Repository, DocTreeNode, UserConfig, ParsedDoc } from "../app";

interface Props {
  repositories: Repository[];
  config: UserConfig | null;
  onRefresh: () => void;
}

interface RepoDocsData {
  repoId: string;
  docs: ParsedDoc[];
  tree: DocTreeNode[];
}

// Check if a topic matches any of the patterns
function matchesTopic(topic: string, patterns: string[]): boolean {
  for (let i = patterns.length - 1; i >= 0; i--) {
    const pattern = patterns[i];
    const isExclude = pattern.startsWith("!");
    const cleanPattern = isExclude ? pattern.slice(1) : pattern;

    // Simple glob matching
    if (cleanPattern === topic) {
      return !isExclude;
    }

    // Handle ** (match any depth)
    if (cleanPattern.endsWith("/**")) {
      const prefix = cleanPattern.slice(0, -3);
      if (topic === prefix || topic.startsWith(prefix + "/")) {
        return !isExclude;
      }
    }

    // Handle * (match single segment)
    if (cleanPattern.endsWith("/*")) {
      const prefix = cleanPattern.slice(0, -2);
      if (topic.startsWith(prefix + "/") && !topic.slice(prefix.length + 1).includes("/")) {
        return !isExclude;
      }
    }
  }

  return false;
}

// Check selection state for a tree node
function getNodeSelectionState(
  node: DocTreeNode,
  patterns: string[]
): "checked" | "unchecked" | "indeterminate" {
  if (!node.isFolder && node.doc) {
    return matchesTopic(node.doc.frontmatter.topic, patterns) ? "checked" : "unchecked";
  }

  // For folders, check children
  if (node.children.length === 0) {
    return "unchecked";
  }

  const childStates = node.children.map((child) =>
    getNodeSelectionState(child, patterns)
  );

  const allChecked = childStates.every((s) => s === "checked");
  const allUnchecked = childStates.every((s) => s === "unchecked");

  if (allChecked) return "checked";
  if (allUnchecked) return "unchecked";
  return "indeterminate";
}

// Generate patterns from selection
function generatePatternsFromSelection(
  tree: DocTreeNode[],
  checked: Set<string>
): string[] {
  const patterns: string[] = [];

  function processNode(node: DocTreeNode): boolean {
    if (!node.isFolder && node.doc) {
      return checked.has(node.doc.frontmatter.topic);
    }

    if (node.children.length === 0) return false;

    const childResults = node.children.map((child) => processNode(child));
    const allTrue = childResults.every(Boolean);
    const someTrue = childResults.some(Boolean);

    if (allTrue) {
      // All children selected - add folder pattern
      patterns.push(`${node.path}/**`);
      return true;
    } else if (someTrue) {
      // Partial selection - recurse (children already added their patterns)
      return false;
    }

    return false;
  }

  // First pass: identify folder-level patterns
  const rootResults = tree.map((node) => processNode(node));

  // Second pass: add individual topic patterns for items not covered by folder patterns
  function addLeafPatterns(node: DocTreeNode) {
    if (!node.isFolder && node.doc) {
      const topic = node.doc.frontmatter.topic;
      if (checked.has(topic)) {
        // Check if already covered by a folder pattern
        const covered = patterns.some((p) => {
          if (p.endsWith("/**")) {
            const prefix = p.slice(0, -3);
            return topic === prefix || topic.startsWith(prefix + "/");
          }
          return false;
        });
        if (!covered) {
          patterns.push(topic);
        }
      }
    }
    node.children.forEach(addLeafPatterns);
  }

  tree.forEach(addLeafPatterns);

  return patterns;
}

function DocTreeNodeComponent({
  node,
  patterns,
  onToggle,
  expanded,
  onExpand,
  depth = 0,
}: {
  node: DocTreeNode;
  patterns: string[];
  onToggle: (topic: string, isFolder: boolean) => void;
  expanded: Set<string>;
  onExpand: (path: string) => void;
  depth?: number;
}) {
  const selectionState = getNodeSelectionState(node, patterns);
  const isExpanded = expanded.has(node.path);

  const handleCheckboxChange = () => {
    if (node.isFolder) {
      onToggle(node.path, true);
    } else if (node.doc) {
      onToggle(node.doc.frontmatter.topic, false);
    }
  };

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 hover:bg-muted rounded cursor-pointer"
        style={{ paddingLeft: depth * 16 + 8 }}
      >
        {node.isFolder && node.children.length > 0 ? (
          <button
            className="w-4 h-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => onExpand(node.path)}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <input
          type="checkbox"
          checked={selectionState === "checked"}
          ref={(el) => {
            if (el) el.indeterminate = selectionState === "indeterminate";
          }}
          onChange={handleCheckboxChange}
          className="h-4 w-4 rounded border-gray-300"
        />

        <span
          className={`text-sm ${node.isFolder ? "font-medium" : ""}`}
          onClick={() => node.isFolder && onExpand(node.path)}
        >
          {node.name}
          {node.isFolder && "/"}
        </span>

        {node.doc && (
          <span className="text-xs text-muted-foreground truncate">
            {node.doc.frontmatter.title}
          </span>
        )}
      </div>

      {node.isFolder && isExpanded && (
        <div>
          {node.children.map((child) => (
            <DocTreeNodeComponent
              key={child.path}
              node={child}
              patterns={patterns}
              onToggle={onToggle}
              expanded={expanded}
              onExpand={onExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TopicSelectionView({ repositories, config, onRefresh }: Props) {
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [repoData, setRepoData] = useState<RepoDocsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [localPatterns, setLocalPatterns] = useState<string[]>(config?.topics || []);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Update local patterns when config changes
  useEffect(() => {
    setLocalPatterns(config?.topics || []);
  }, [config]);

  // Collect all folder paths from tree for expand all
  const collectAllFolderPaths = (nodes: DocTreeNode[]): string[] => {
    const paths: string[] = [];
    const traverse = (node: DocTreeNode) => {
      if (node.isFolder) {
        paths.push(node.path);
        node.children.forEach(traverse);
      }
    };
    nodes.forEach(traverse);
    return paths;
  };

  // Fetch docs when repo changes
  useEffect(() => {
    if (!selectedRepoId) {
      setRepoData(null);
      return;
    }

    setLoading(true);
    fetch(`/api/repositories/${encodeURIComponent(selectedRepoId)}/docs`)
      .then((res) => res.json())
      .then((data) => {
        setRepoData({
          repoId: selectedRepoId,
          docs: data.docs,
          tree: data.tree,
        });
        // Start collapsed
        setExpanded(new Set());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedRepoId]);

  // Auto-select first repo
  useEffect(() => {
    if (!selectedRepoId && repositories.length > 0) {
      setSelectedRepoId(repositories[0].id);
    }
  }, [repositories, selectedRepoId]);

  // Count selected topics
  const selectedCount = useMemo(() => {
    if (!repoData) return 0;
    let count = 0;
    function countDocs(node: DocTreeNode) {
      if (!node.isFolder && node.doc) {
        if (matchesTopic(node.doc.frontmatter.topic, localPatterns)) {
          count++;
        }
      }
      node.children.forEach(countDocs);
    }
    repoData.tree.forEach(countDocs);
    return count;
  }, [repoData, localPatterns]);

  const totalCount = useMemo(() => {
    if (!repoData) return 0;
    return repoData.docs.length;
  }, [repoData]);

  const handleToggle = (topic: string, isFolder: boolean) => {
    // Build set of currently checked topics
    const checked = new Set<string>();
    if (repoData) {
      function collectChecked(node: DocTreeNode) {
        if (!node.isFolder && node.doc) {
          if (matchesTopic(node.doc.frontmatter.topic, localPatterns)) {
            checked.add(node.doc.frontmatter.topic);
          }
        }
        node.children.forEach(collectChecked);
      }
      repoData.tree.forEach(collectChecked);
    }

    if (isFolder) {
      // Toggle all descendants of this folder
      const prefix = topic + "/";
      const allDescendantsChecked = repoData?.docs
        .filter((d) => d.frontmatter.topic.startsWith(prefix) || d.frontmatter.topic === topic)
        .every((d) => checked.has(d.frontmatter.topic));

      repoData?.docs.forEach((d) => {
        if (d.frontmatter.topic.startsWith(prefix) || d.frontmatter.topic === topic) {
          if (allDescendantsChecked) {
            checked.delete(d.frontmatter.topic);
          } else {
            checked.add(d.frontmatter.topic);
          }
        }
      });
    } else {
      // Toggle single topic
      if (checked.has(topic)) {
        checked.delete(topic);
      } else {
        checked.add(topic);
      }
    }

    // Generate new patterns from selection
    if (repoData) {
      const newPatterns = generatePatternsFromSelection(repoData.tree, checked);
      setLocalPatterns(newPatterns);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: localPatterns }),
      });
      onRefresh();
    } catch (e) {
      console.error("Failed to save config:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      // Save first, then pull
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: localPatterns }),
      });
      const res = await fetch("/api/pull", { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        setSyncError(data.error || "Failed to sync");
        return;
      }
      onRefresh();
    } catch (e) {
      console.error("Failed to sync:", e);
      setSyncError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const hasChanges = JSON.stringify(localPatterns) !== JSON.stringify(config?.topics || []);

  return (
    <div className="h-full flex">
      {/* Left panel - Repository selector + Tree */}
      <div className="w-96 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <label className="text-sm font-medium mb-2 block">
            Select Repository
          </label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm"
            value={selectedRepoId || ""}
            onChange={(e) => setSelectedRepoId(e.target.value || null)}
          >
            <option value="">Select a repository...</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.type === "github" ? repo.id : repo.path.split("/").pop()}
              </option>
            ))}
          </select>
        </div>

        {repoData && (
          <div className="px-4 py-2 border-b flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(new Set(collectAllFolderPaths(repoData.tree)))}
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
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading docs...</div>
          ) : repoData ? (
            <div className="py-2">
              {repoData.tree.map((node) => (
                <DocTreeNodeComponent
                  key={node.path}
                  node={node}
                  patterns={localPatterns}
                  onToggle={handleToggle}
                  expanded={expanded}
                  onExpand={handleExpand}
                />
              ))}
            </div>
          ) : (
            <div className="p-4 text-sm text-muted-foreground">
              Select a repository to view available docs
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right panel - Pattern preview */}
      <div className="flex-1 p-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>Selection Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-2xl font-bold">
                {selectedCount} / {totalCount}
              </div>
              <div className="text-sm text-muted-foreground">
                topics selected
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">Topic Patterns</h3>
              {localPatterns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No topics selected. Use the checkboxes to select docs.
                </p>
              ) : (
                <div className="space-y-1">
                  {localPatterns.map((pattern, i) => (
                    <div
                      key={i}
                      className={`text-sm font-mono px-2 py-1 rounded ${
                        pattern.startsWith("!")
                          ? "bg-destructive/10 text-destructive"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {pattern}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                variant="outline"
              >
                {saving ? "Saving..." : "Save Config"}
              </Button>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? "Syncing..." : "Save & Sync to Project"}
              </Button>
            </div>

            {hasChanges && (
              <p className="text-sm text-amber-600">
                You have unsaved changes
              </p>
            )}

            {syncError && (
              <p className="text-sm text-destructive">
                Error: {syncError}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
