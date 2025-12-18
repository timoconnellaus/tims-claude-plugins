import React, { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RepositoriesView } from "./components/RepositoriesView";
import { TopicSelectionView } from "./components/TopicSelectionView";
import { SyncedDocsView } from "./components/SyncedDocsView";

// Types from the backend
interface Repository {
  id: string;
  type: "local" | "github";
  path: string;
  addedAt: string;
  docsPath?: string;
}

interface DocFrontmatter {
  topic: string;
  title: string;
  description?: string;
  version?: string;
  lastUpdated?: string;
  sourceUrl?: string;
  tags?: string[];
}

interface ParsedDoc {
  path: string;
  frontmatter: DocFrontmatter;
  content: string;
  lineCount: number;
}

interface DocTreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  children: DocTreeNode[];
  doc?: ParsedDoc;
}

interface UserConfig {
  version: 1;
  topics: string[];
  lastSync?: string;
  source?: string;
}

export type { Repository, ParsedDoc, DocTreeNode, UserConfig, DocFrontmatter };

type ViewType = "repos" | "topics" | "synced";

function Header({
  view,
  onViewChange,
}: {
  view: ViewType;
  onViewChange: (v: ViewType) => void;
}) {
  return (
    <header className="border-b bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Docs Skill</h1>
        <div className="flex gap-2">
          <Button
            variant={view === "repos" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("repos")}
          >
            Repositories
          </Button>
          <Button
            variant={view === "topics" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("topics")}
          >
            Topic Selection
          </Button>
          <Button
            variant={view === "synced" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewChange("synced")}
          >
            Synced Docs
          </Button>
        </div>
      </div>
    </header>
  );
}

function App() {
  const [view, setView] = useState<ViewType>("topics");
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [syncedDocs, setSyncedDocs] = useState<ParsedDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      const [reposRes, configRes, syncedRes] = await Promise.all([
        fetch("/api/repositories"),
        fetch("/api/config"),
        fetch("/api/synced-docs"),
      ]);

      setRepositories(await reposRes.json());
      setConfig(await configRes.json());
      setSyncedDocs(await syncedRes.json());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // SSE for live updates
  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.onmessage = (event) => {
      if (event.data === "refresh") {
        fetchData();
      }
    };

    eventSource.onerror = () => {
      console.error("SSE connection error");
    };

    return () => {
      eventSource.close();
    };
  }, [fetchData]);

  // Update URL with view
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState({}, "", url.toString());
  }, [view]);

  // Read view from URL on mount
  useEffect(() => {
    const url = new URL(window.location.href);
    const urlView = url.searchParams.get("view") as ViewType | null;
    if (urlView && ["repos", "topics", "synced"].includes(urlView)) {
      setView(urlView);
    }
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <Header view={view} onViewChange={setView} />

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm">
          {error}
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {view === "repos" && (
          <RepositoriesView
            repositories={repositories}
            onRefresh={fetchData}
          />
        )}
        {view === "topics" && (
          <TopicSelectionView
            repositories={repositories}
            config={config}
            onRefresh={fetchData}
          />
        )}
        {view === "synced" && (
          <SyncedDocsView
            docs={syncedDocs}
            config={config}
            onRefresh={fetchData}
          />
        )}
      </main>
    </div>
  );
}

// Mount the app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
