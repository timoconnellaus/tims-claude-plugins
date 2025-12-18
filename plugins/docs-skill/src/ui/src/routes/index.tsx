import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";

import { Button } from "@/components/ui/button";
import { RepositoriesView } from "../../components/RepositoriesView";
import { TopicSelectionView } from "../../components/TopicSelectionView";
import { SyncedDocsView } from "../../components/SyncedDocsView";

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

interface UserConfig {
  version: 1;
  topics: string[];
  lastSync?: string;
  source?: string;
}

type ViewType = "repos" | "topics" | "synced";

// Search params schema
const searchSchema = z.object({
  view: fallback(z.enum(["repos", "topics", "synced"]), "topics").default("topics"),
});

export const Route = createFileRoute("/")({
  validateSearch: zodValidator(searchSchema),
  component: Home,
});

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

function Home() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const view = search.view as ViewType;

  const setView = useCallback(
    (newView: ViewType) => {
      navigate({ search: { view: newView } });
    },
    [navigate]
  );

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
          <RepositoriesView repositories={repositories} onRefresh={fetchData} />
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
