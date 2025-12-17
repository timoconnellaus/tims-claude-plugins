import { useMemo, useEffect, useRef } from "react";
import type { GroupWithData, RequirementWithData } from "./RequirementList";

// Health badge types and configuration
type HealthBadge = "blocked" | "stale" | "needs-tests" | "planned" | "unverified" | "verified";

const BADGE_CONFIG: Record<HealthBadge, { color: string; label: string; order: number }> = {
  blocked:       { color: "bg-red-500",    label: "blocked",      order: 0 },
  stale:         { color: "bg-orange-400", label: "stale",        order: 1 },
  "needs-tests": { color: "bg-yellow-400", label: "needs tests",  order: 2 },
  planned:       { color: "bg-gray-300",   label: "planned",      order: 3 },
  unverified:    { color: "bg-blue-400",   label: "unverified",   order: 4 },
  verified:      { color: "bg-green-500",  label: "verified",     order: 5 },
};

function computeBadge(req: RequirementWithData): HealthBadge {
  if (req.dependencyIssues && req.dependencyIssues.length > 0) return "blocked";
  if (req.verification === "stale") return "stale";
  if (req.status === "done" && req.testCount === 0) return "needs-tests";
  if (req.status === "planned") return "planned";
  if (req.verification === "unverified") return "unverified";
  return "verified";
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: TreeNode[];
  requirement?: RequirementWithData;
  badge?: HealthBadge;                    // For requirements
  distribution?: Map<HealthBadge, number>; // For folders
}

// Compute distribution of badges for a folder (recursively includes nested folders)
function computeDistribution(node: TreeNode): Map<HealthBadge, number> {
  const dist = new Map<HealthBadge, number>();

  for (const child of node.children) {
    if (child.isFolder) {
      const childDist = computeDistribution(child);
      child.distribution = childDist;
      for (const [badge, count] of childDist) {
        dist.set(badge, (dist.get(badge) || 0) + count);
      }
    } else if (child.badge) {
      dist.set(child.badge, (dist.get(child.badge) || 0) + 1);
    }
  }

  return dist;
}

interface RequirementTreeProps {
  groups: GroupWithData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  expanded: Set<string>;
  onSetExpanded: (expanded: Set<string>) => void;
  onToggle: (path: string) => void;
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
        badge: computeBadge(req),
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

  // Compute badge distributions for all folders (bottom-up)
  for (const child of root.children) {
    if (child.isFolder) {
      child.distribution = computeDistribution(child);
    }
  }

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
    // Sort distribution by badge order (worst first)
    const sortedDist = node.distribution
      ? Array.from(node.distribution.entries()).sort(
          (a, b) => BADGE_CONFIG[a[0]].order - BADGE_CONFIG[b[0]].order
        )
      : [];

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
          {sortedDist.length > 0 && (
            <span className="ml-2 flex gap-2 text-xs flex-none">
              {sortedDist.map(([badge, count]) => (
                <span key={badge} className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${BADGE_CONFIG[badge].color}`} />
                  <span className="text-gray-500">{count}</span>
                </span>
              ))}
            </span>
          )}
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
  const badge = node.badge!;
  const badgeConfig = BADGE_CONFIG[badge];

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
      <span className="flex items-center gap-1.5 flex-none">
        <span className={`w-2 h-2 rounded-full ${badgeConfig.color}`} />
        <span className="text-xs text-gray-500">{badgeConfig.label}</span>
      </span>
    </button>
  );
}

function collectAllFolderPaths(nodes: TreeNode[]): Set<string> {
  const paths = new Set<string>();
  const collect = (nodeList: TreeNode[]) => {
    for (const node of nodeList) {
      if (node.isFolder) {
        paths.add(node.path);
        collect(node.children);
      }
    }
  };
  collect(nodes);
  return paths;
}

export function RequirementTree({
  groups,
  selectedId,
  onSelect,
  expanded,
  onSetExpanded,
  onToggle,
}: RequirementTreeProps) {
  const tree = useMemo(() => buildTree(groups), [groups]);
  const hasInitialized = useRef(false);

  // Initialize with all folders expanded if URL has no expanded state
  useEffect(() => {
    if (!hasInitialized.current && expanded.size === 0 && tree.length > 0) {
      hasInitialized.current = true;
      const allPaths = collectAllFolderPaths(tree);
      if (allPaths.size > 0) {
        onSetExpanded(allPaths);
      }
    }
  }, [tree, expanded, onSetExpanded]);

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
          onToggle={onToggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
