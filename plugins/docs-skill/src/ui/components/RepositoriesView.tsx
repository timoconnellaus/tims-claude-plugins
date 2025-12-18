import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Repository } from "../app";

interface Props {
  repositories: Repository[];
  onRefresh: () => void;
}

export function RepositoriesView({ repositories, onRefresh }: Props) {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newRepoPath, setNewRepoPath] = useState("");
  const [newRepoDocsPath, setNewRepoDocsPath] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAddRepo = async () => {
    if (!newRepoPath.trim()) return;

    setAdding(true);
    setAddError(null);

    try {
      const res = await fetch("/api/repositories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: newRepoPath.trim(),
          docsPath: newRepoDocsPath.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setAddError(data.error || "Failed to add repository");
        return;
      }

      setNewRepoPath("");
      setNewRepoDocsPath("");
      setShowAddDialog(false);
      onRefresh();
    } catch (e) {
      setAddError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveRepo = async (id: string) => {
    try {
      await fetch(`/api/repositories/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setSelectedRepo(null);
      onRefresh();
    } catch (e) {
      console.error("Failed to remove repository:", e);
    }
  };

  return (
    <div className="h-full flex">
      {/* Repository List */}
      <div className="w-80 border-r bg-white flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold mb-3">Documentation Repositories</h2>
          <AlertDialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="w-full">
                + Add Repository
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Add Documentation Repository</AlertDialogTitle>
                <AlertDialogDescription>
                  Add a local path or GitHub URL containing documentation.
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Path or GitHub URL
                  </label>
                  <Input
                    placeholder="/path/to/repo or https://github.com/owner/repo"
                    value={newRepoPath}
                    onChange={(e) => setNewRepoPath(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Docs Path (optional)
                  </label>
                  <Input
                    placeholder="docs (default)"
                    value={newRepoDocsPath}
                    onChange={(e) => setNewRepoDocsPath(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Subdirectory containing documentation files
                  </p>
                </div>
                {addError && (
                  <p className="text-sm text-destructive">{addError}</p>
                )}
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button onClick={handleAddRepo} disabled={adding || !newRepoPath.trim()}>
                  {adding ? "Adding..." : "Add Repository"}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {repositories.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">
                No repositories registered. Add one to get started.
              </p>
            ) : (
              repositories.map((repo) => (
                <button
                  key={repo.id}
                  className={`w-full text-left p-3 rounded-md mb-1 transition-colors ${
                    selectedRepo?.id === repo.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => setSelectedRepo(repo)}
                >
                  <div className="font-medium text-sm truncate">
                    {repo.type === "github" ? repo.id : repo.path.split("/").pop()}
                  </div>
                  <div
                    className={`text-xs truncate ${
                      selectedRepo?.id === repo.id
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }`}
                  >
                    {repo.type === "local" ? repo.path : "GitHub"}
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Repository Detail */}
      <div className="flex-1 p-6">
        {selectedRepo ? (
          <Card>
            <CardHeader>
              <CardTitle>Repository Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  ID
                </label>
                <p className="font-mono text-sm">{selectedRepo.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Type
                </label>
                <p className="text-sm capitalize">{selectedRepo.type}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Path
                </label>
                <p className="text-sm font-mono break-all">{selectedRepo.path}</p>
              </div>
              {selectedRepo.docsPath && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Docs Path
                  </label>
                  <p className="text-sm font-mono">{selectedRepo.docsPath}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Added
                </label>
                <p className="text-sm">
                  {new Date(selectedRepo.addedAt).toLocaleString()}
                </p>
              </div>

              <div className="pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Remove Repository
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Repository?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the repository from your global configuration.
                        Any synced docs will remain in your projects.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemoveRepo(selectedRepo.id)}
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Select a repository to view details
          </div>
        )}
      </div>
    </div>
  );
}
