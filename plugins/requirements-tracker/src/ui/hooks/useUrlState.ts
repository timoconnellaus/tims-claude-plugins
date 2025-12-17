import { useState, useEffect, useCallback, useRef } from "react";
import type { FilterType } from "../components/Dashboard";

export type ViewMode = "requirements" | "docs";

export interface UrlState {
  req: string | null;
  expanded: Set<string>;
  filter: FilterType;
  view: ViewMode;
  doc: string;
}

export interface UrlStateSetters {
  setReq: (id: string | null) => void;
  setExpanded: (expanded: Set<string>) => void;
  toggleExpanded: (path: string) => void;
  setFilter: (filter: FilterType) => void;
  setView: (view: ViewMode) => void;
  setDoc: (doc: string) => void;
}

function parseUrlState(): UrlState {
  const params = new URLSearchParams(window.location.search);

  const req = params.get("req");
  const expandedStr = params.get("expanded");
  const filter = params.get("filter") as FilterType;
  const view = (params.get("view") as ViewMode) || "requirements";
  const doc = params.get("doc") || "index";

  // Parse expanded folders - if not set, will be populated with all folders on first render
  const expanded = expandedStr
    ? new Set(expandedStr.split(",").filter(Boolean))
    : new Set<string>();

  return { req, expanded, filter, view, doc };
}

function buildUrl(state: UrlState): string {
  const params = new URLSearchParams();

  if (state.req) {
    params.set("req", state.req);
  }

  if (state.expanded.size > 0) {
    params.set("expanded", Array.from(state.expanded).join(","));
  }

  if (state.filter) {
    params.set("filter", state.filter);
  }

  if (state.view !== "requirements") {
    params.set("view", state.view);
  }

  if (state.view === "docs" && state.doc !== "index") {
    params.set("doc", state.doc);
  }

  const search = params.toString();
  return search ? `?${search}` : window.location.pathname;
}

export function useUrlState(): [UrlState, UrlStateSetters] {
  const [state, setState] = useState<UrlState>(parseUrlState);
  const isInitialMount = useRef(true);

  // Update URL when state changes (but not on initial mount)
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const url = buildUrl(state);
    history.replaceState(null, "", url);
  }, [state]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setState(parseUrlState());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const setReq = useCallback((req: string | null) => {
    setState((prev) => ({ ...prev, req }));
  }, []);

  const setExpanded = useCallback((expanded: Set<string>) => {
    setState((prev) => ({ ...prev, expanded }));
  }, []);

  const toggleExpanded = useCallback((path: string) => {
    setState((prev) => {
      const next = new Set(prev.expanded);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { ...prev, expanded: next };
    });
  }, []);

  const setFilter = useCallback((filter: FilterType) => {
    setState((prev) => ({ ...prev, filter }));
  }, []);

  const setView = useCallback((view: ViewMode) => {
    setState((prev) => ({ ...prev, view }));
  }, []);

  const setDoc = useCallback((doc: string) => {
    setState((prev) => ({ ...prev, doc }));
  }, []);

  const setters: UrlStateSetters = {
    setReq,
    setExpanded,
    toggleExpanded,
    setFilter,
    setView,
    setDoc,
  };

  return [state, setters];
}
