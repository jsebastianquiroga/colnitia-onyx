"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Text } from "@opal/components";
import { IllustrationContent } from "@opal/layouts";
import { Button } from "@opal/components";
import { SvgRefreshCw } from "@opal/icons";
import useChatSessions from "@/hooks/useChatSessions";
import { useAgents } from "@/hooks/useAgents";
import { deleteChatSession } from "@/app/app/services/lib";
import InputTypeIn from "@/refresh-components/inputs/InputTypeIn";
import SwipeableItem from "@/components/mobile/SwipeableItem";
import { UNNAMED_CHAT } from "@/lib/constants";

interface HistoryTabProps {
  isActive: boolean;
  onSelectChat: (chatId: string) => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "ahora";
  if (diffMins < 60) return `hace ${diffMins}m`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString();
}

function HistoryTab({ isActive, onSelectChat }: HistoryTabProps) {
  const [filter, setFilter] = useState("");
  const { agents } = useAgents();

  const agentNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const agent of agents) {
      map.set(agent.id, agent.name);
    }
    return map;
  }, [agents]);

  const {
    chatSessions,
    error,
    refreshChatSessions,
    removeSession,
    hasMore,
    isLoadingMore,
    loadMore,
    isLoading,
  } = useChatSessions();

  // Sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreRef.current();
        }
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore]);

  const filteredSessions = useMemo(() => {
    if (!filter.trim()) return chatSessions;
    const lower = filter.toLowerCase();
    return chatSessions.filter((s) => {
      const name = s.name || UNNAMED_CHAT;
      return name.toLowerCase().includes(lower);
    });
  }, [chatSessions, filter]);

  const handleDelete = useCallback(
    async (sessionId: string) => {
      removeSession(sessionId);
      await deleteChatSession(sessionId);
    },
    [removeSession]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6">
        <IllustrationContent
          title="No se pudo cargar el historial"
          description="Ocurrio un error al cargar las conversaciones."
        />
        <Button
          variant="default"
          prominence="secondary"
          icon={SvgRefreshCw}
          onClick={() => refreshChatSessions()}
        >
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="HistoryTab">
      {/* Filter */}
      <div className="px-3 pt-3 pb-2">
        <InputTypeIn
          placeholder="Filtrar conversaciones..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Text font="main-ui-body" color="text-03">
              Cargando...
            </Text>
          </div>
        )}
        {!isLoading && filteredSessions.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Text font="main-ui-body" color="text-03">
              No hay conversaciones
            </Text>
          </div>
        )}
        {filteredSessions.map((session) => (
          <SwipeableItem
            key={session.id}
            onDelete={() => handleDelete(session.id)}
          >
            <button
              type="button"
              className={cn(
                "flex flex-col gap-0.5 w-full px-4 py-3 text-left",
                "min-h-[44px]",
                "active:bg-background-tint-02"
              )}
              onClick={() => onSelectChat(session.id)}
              data-testid={`HistoryTab/session-${session.id}`}
            >
              <Text font="main-ui-action" color="text-01">
                {session.name || UNNAMED_CHAT}
              </Text>
              <div className="flex items-center gap-2">
                {agentNameMap.get(session.persona_id) && (
                  <>
                    <Text font="secondary-body" color="text-04">
                      {agentNameMap.get(session.persona_id)}
                    </Text>
                    <Text font="secondary-body" color="text-04">
                      &middot;
                    </Text>
                  </>
                )}
                <Text font="secondary-body" color="text-03">
                  {formatRelativeDate(session.time_updated)}
                </Text>
              </div>
            </button>
          </SwipeableItem>
        ))}
        {/* Sentinel for infinite scroll */}
        {hasMore && (
          <div ref={sentinelRef} className="h-4">
            {isLoadingMore && (
              <div className="flex items-center justify-center py-2">
                <Text font="secondary-body" color="text-03">
                  Cargando mas...
                </Text>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryTab;
