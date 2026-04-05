"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import { cn } from "@/lib/utils";
import { Text } from "@opal/components";
import { errorHandlingFetcher } from "@/lib/fetcher";
import InputTypeIn from "@/refresh-components/inputs/InputTypeIn";
import PullToRefresh from "@/components/mobile/PullToRefresh";
import useScreenSize from "@/hooks/useScreenSize";

interface SearchResult {
  document_id: string;
  semantic_identifier: string;
  blurb: string;
  source_type: string;
  link: string;
}

interface SearchResponse {
  top_documents: SearchResult[];
}

const SOURCE_FILTER_CHIPS = [
  { key: "all", label: "Todos" },
  { key: "web", label: "Documentos" },
  { key: "slack", label: "Slack" },
  { key: "confluence", label: "Confluence" },
] as const;

const DATE_FILTER_CHIPS = [
  { key: "any", label: "Cualquier fecha" },
  { key: "today", label: "Hoy" },
  { key: "week", label: "Esta semana" },
  { key: "month", label: "Este mes" },
] as const;

interface SearchTabProps {
  isActive: boolean;
}

function SearchTab({ isActive }: SearchTabProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeSource, setActiveSource] = useState<string>("all");
  const [activeDate, setActiveDate] = useState<string>("any");
  const inputRef = useRef<HTMLInputElement>(null);
  const { isTablet } = useScreenSize();

  // Auto-focus on tab activation
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  // Debounce query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, mutate, isLoading } = useSWR<SearchResponse>(
    debouncedQuery.length >= 2
      ? `/api/search?query=${encodeURIComponent(debouncedQuery)}`
      : null,
    errorHandlingFetcher,
    { revalidateOnFocus: false }
  );

  const handleRefresh = useCallback(async () => {
    await mutate();
  }, [mutate]);

  const results = data?.top_documents ?? [];

  return (
    <div className="flex flex-col h-full" data-testid="SearchTab">
      {/* Search bar */}
      <div className="px-3 pt-3 pb-2">
        <InputTypeIn
          ref={inputRef}
          placeholder="Buscar..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Filter chips */}
      <div
        className="flex gap-2 px-3 pb-2 overflow-x-auto"
        data-testid="SearchTab/filter-chips"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {SOURCE_FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-sm",
              "min-h-[36px] min-w-[44px]",
              "border transition-colors",
              activeSource === chip.key
                ? "bg-theme-primary-05 text-text-inverted-01 border-theme-primary-05"
                : "bg-background-neutral-01 text-text-02 border-border-02"
            )}
            onClick={() => setActiveSource(chip.key)}
          >
            <Text font="secondary-action" color={activeSource === chip.key ? "text-inverted-01" : "text-02"}>
              {chip.label}
            </Text>
          </button>
        ))}
        {DATE_FILTER_CHIPS.map((chip) => (
          <button
            key={chip.key}
            type="button"
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-sm",
              "min-h-[36px] min-w-[44px]",
              "border transition-colors",
              activeDate === chip.key
                ? "bg-theme-primary-05 text-text-inverted-01 border-theme-primary-05"
                : "bg-background-neutral-01 text-text-02 border-border-02"
            )}
            onClick={() => setActiveDate(chip.key)}
          >
            <Text font="secondary-action" color={activeDate === chip.key ? "text-inverted-01" : "text-02"}>
              {chip.label}
            </Text>
          </button>
        ))}
      </div>

      {/* Results */}
      <PullToRefresh onRefresh={handleRefresh}>
        <div
          className={cn(
            "flex flex-col gap-2 px-3 pb-4",
            isTablet && "grid grid-cols-2 gap-3"
          )}
        >
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Text font="main-ui-body" color="text-03">
                Buscando...
              </Text>
            </div>
          )}
          {!isLoading && results.length === 0 && debouncedQuery.length >= 2 && (
            <div className="flex items-center justify-center py-8">
              <Text font="main-ui-body" color="text-03">
                No se encontraron resultados
              </Text>
            </div>
          )}
          {results.map((result) => (
            <SearchResultCard key={result.document_id} result={result} />
          ))}
        </div>
      </PullToRefresh>
    </div>
  );
}

interface SearchResultCardProps {
  result: SearchResult;
}

function SearchResultCard({ result }: SearchResultCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 p-3",
        "bg-background-neutral-01 border border-border-02 rounded-lg",
        "active:bg-background-tint-02"
      )}
    >
      <Text font="main-ui-action" color="text-01">
        {result.semantic_identifier}
      </Text>
      <Text
        font="secondary-body"
        color="text-03"
        as="p"
      >
        {result.blurb?.slice(0, 120)}
      </Text>
      <Text font="secondary-action" color="text-04">
        {result.source_type}
      </Text>
    </div>
  );
}

export default SearchTab;
