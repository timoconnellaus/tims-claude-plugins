import { useState, useMemo } from "react";
import type { GroupWithData, RequirementWithData } from "./RequirementList";

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  requirement?: RequirementWithData;
}

interface RequirementTreeProps {
  groups: GroupWithData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function buildTree(groups: GroupWithData[]): TreeNode[] {
  const root: TreeNode = {
    name: "",
    path: "",
    isFolder: true,
    children: [],
  };

  for (const group of groups) {
    const pathParts = group.path ? group.path.split("/").filter(Boolean) : [];
    let current = root;

    // Navigate/create folder structure
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const fullPath = pathParts.slice(0, i + 1).join("/");

      let child = current.children.find(
        (c) => c.isFolder && c.name === part
      );
      if (!child) {
        child = {
          name: part,
          path: fullPath,
          isFolder: true,
          children: [],
        };
        current.children.push(child);
      }
      current = child;
    }

    // Add requirements as leaf nodes
    for (const req of group.requirements) {
      const filename = req.id.split("/").pop() || req.id;
      const displayName = filename.replace(/^REQ_/, "").replace(/\.yml$/, "");
      current.children.push({
        name: displayName,
        path: req.id,
        isFolder: false,
        children: [],
        requirement: req,
      });
    }
  }

  // Sort: folders first (alphabetically), then requirements (alphabetically)
  const sortChildren = (node: TreeNode) => {
    node.children.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const child of node.children) {
      if (child.isFolder) sortChildren(child);
    }
  };
  sortChildren(root);

  return root.children;
}

interface TreeNodeComponentProps {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function TreeNodeComponent({
  node,
  depth,
  expanded,
  onToggle,
  selectedId,
  onSelect,
}: TreeNodeComponentProps) {
  const isExpanded = expanded.has(node.path);
  const paddingLeft = depth * 16;

  if (node.isFolder) {
    return (
      <div>
        <button
          onClick={() => onToggle(node.path)}
          className="w-full text-left py-1 px-2 hover:bg-gray-100 flex items-center gap-1 text-sm"
          style={{ paddingLeft }}
        >
          <span className="text-gray-400 w-4 text-center flex-none">
            {isExpanded ? "▼" : "▶"}
          </span>
          <span className="font-medium text-gray-700 truncate">{node.name}/</span>
        </button>
        {isExpanded && (
          <div>
            {node.children.map((child) => (
              <TreeNodeComponent
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Requirement leaf node
  const req = node.requirement!;
  const isSelected = req.id === selectedId;

  // Indicator data
  const hasGherkin = Boolean(req.gherkin?.trim());
  const hasNfrs = Boolean(req.nfrs && req.nfrs.length > 0);
  const hasTests = req.testCount > 0;
  const hasTestIssues = req.aiAssessment?.testComments?.some(tc => tc.hasIssue) ?? false;
  const coverageSufficient = req.coverageSufficient;
  const isDone = req.status === "done";
  const isVerified = req.verification === "verified";
  const needsVerification = req.verification === "unverified" || req.verification === "stale";

  // Dependencies
  const totalDeps = req.dependencies?.length || 0;
  const blockedDeps = req.dependencyIssues?.length || 0;
  const passingDeps = totalDeps - blockedDeps;
  const depsAllPassing = totalDeps > 0 && blockedDeps === 0;

  // Priority styling
  const priorityStyles: Record<string, { color: string; label: string }> = {
    critical: { color: 'text-red-600', label: 'P1' },
    high: { color: 'text-orange-500', label: 'P2' },
    medium: { color: 'text-yellow-600', label: 'P3' },
    low: { color: 'text-gray-400', label: 'P4' },
  };
  const priority = req.priority ? priorityStyles[req.priority] : null;

  return (
    <button
      onClick={() => onSelect(req.id)}
      className={`w-full text-left py-1 px-2 flex items-center gap-2 text-sm ${
        isSelected
          ? "bg-blue-50 text-blue-900"
          : "hover:bg-gray-50 text-gray-700"
      }`}
      style={{ paddingLeft }}
    >
      <span className="text-gray-300 w-4 text-center flex-none">•</span>
      <span className="font-mono truncate flex-1 min-w-0">{node.name}</span>

      {/* R F - Gherkin & NFRs */}
      <span className="flex gap-1 text-xs font-medium flex-none">
        <span className={hasGherkin ? 'text-green-600' : 'text-gray-300'}>R</span>
        <span className={hasNfrs ? 'text-green-600' : 'text-gray-300'}>F</span>
      </span>

      {/* T:N - Tests (with ! if issues) */}
      <span className={`text-xs flex-none ${hasTestIssues ? 'text-red-500' : hasTests ? 'text-green-600' : 'text-gray-300'}`}>
        T:{req.testCount}{hasTestIssues ? '!' : ''}
      </span>

      {/* C - Coverage sufficient */}
      <span className={`text-xs flex-none ${coverageSufficient === true ? 'text-green-600' : coverageSufficient === false ? 'text-red-500' : 'text-gray-300'}`}>
        C
      </span>

      {/* D:X/Y - Deps (always show) */}
      <span className={`text-xs flex-none ${totalDeps === 0 ? 'text-gray-300' : depsAllPassing ? 'text-green-600' : 'text-yellow-600'}`}>
        D:{totalDeps === 0 ? '0' : `${passingDeps}/${totalDeps}`}
      </span>

      {/* P1-P4 - Priority (always show) */}
      <span className={`text-xs font-medium flex-none ${priority ? priority.color : 'text-gray-300'}`}>
        {priority ? priority.label : 'P-'}
      </span>

      {/* done/plan - Status */}
      <span className={`text-xs flex-none ${isDone ? 'text-blue-600' : 'text-gray-400'}`}>
        {isDone ? 'done' : 'plan'}
      </span>

      {/* ✓ or ! - Verified */}
      <span className={`text-xs flex-none ${isVerified ? 'text-green-600' : needsVerification ? 'text-yellow-500' : 'text-gray-300'}`}>
        {needsVerification ? '!' : '✓'}
      </span>

      {/* ? - Questions (always show, green if none/all answered, red if unanswered) */}
      <span className={`text-xs flex-none ${req.unansweredQuestions > 0 ? 'text-red-500' : 'text-green-600'}`}>
        {req.unansweredQuestions > 0 ? `?${req.unansweredQuestions}` : '?'}
      </span>
    </button>
  );
}

export function RequirementTree({
  groups,
  selectedId,
  onSelect,
}: RequirementTreeProps) {
  const tree = useMemo(() => buildTree(groups), [groups]);

  // Start with all folders expanded
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const paths = new Set<string>();
    const collectPaths = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        if (node.isFolder) {
          paths.add(node.path);
          collectPaths(node.children);
        }
      }
    };
    collectPaths(tree);
    return paths;
  });

  const handleToggle = (path: string) => {
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

  if (tree.length === 0) {
    return null;
  }

  return (
    <div className="text-sm">
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          expanded={expanded}
          onToggle={handleToggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
