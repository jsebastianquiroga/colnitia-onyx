"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { FullChatState } from "@/app/app/message/messageComponents/interfaces";
import { Message } from "@/app/app/interfaces";
import { LlmManager } from "@/lib/hooks";
import { RegenerationFactory } from "@/app/app/message/messageComponents/AgentMessage";
import MultiModelPanel from "@/app/app/message/MultiModelPanel";
import { MultiModelResponse } from "@/app/app/message/interfaces";
import { cn } from "@/lib/utils";

export interface MultiModelResponseViewProps {
  responses: MultiModelResponse[];
  chatState: FullChatState;
  llmManager: LlmManager | null;
  onRegenerate?: RegenerationFactory;
  parentMessage?: Message | null;
  otherMessagesCanSwitchTo?: number[];
  onMessageSelection?: (nodeId: number) => void;
}

// How many pixels of a non-preferred panel are visible at the viewport edge
const PEEK_W = 64;
// Width of each non-preferred panel in the selection layout
const PANEL_W = 400;
// Gap between panels
const PANEL_GAP = 16;

export default function MultiModelResponseView({
  responses,
  chatState,
  llmManager,
  onRegenerate,
  parentMessage,
  otherMessagesCanSwitchTo,
  onMessageSelection,
}: MultiModelResponseViewProps) {
  const [preferredIndex, setPreferredIndex] = useState<number | null>(null);
  const [hiddenPanels, setHiddenPanels] = useState<Set<number>>(new Set());
  // Controls animation: false = panels at start position, true = panels at peek position
  const [selectionEntered, setSelectionEntered] = useState(false);

  const isGenerating = useMemo(
    () => responses.some((r) => r.isGenerating),
    [responses]
  );

  const visibleResponses = useMemo(
    () => responses.filter((r) => !hiddenPanels.has(r.modelIndex)),
    [responses, hiddenPanels]
  );

  const hiddenResponses = useMemo(
    () => responses.filter((r) => hiddenPanels.has(r.modelIndex)),
    [responses, hiddenPanels]
  );

  const toggleVisibility = useCallback(
    (modelIndex: number) => {
      setHiddenPanels((prev) => {
        const next = new Set(prev);
        if (next.has(modelIndex)) {
          next.delete(modelIndex);
        } else {
          // Don't hide the last visible panel
          const visibleCount = responses.length - next.size;
          if (visibleCount <= 1) return prev;
          next.add(modelIndex);
        }
        return next;
      });
    },
    [responses.length]
  );

  const handleSelectPreferred = useCallback(
    (modelIndex: number) => {
      setPreferredIndex(modelIndex);
      const response = responses[modelIndex];
      if (!response) return;
      if (onMessageSelection) {
        onMessageSelection(response.nodeId);
      }
    },
    [responses, onMessageSelection]
  );

  // Selection mode when preferred is set and not generating
  const showSelectionMode =
    preferredIndex !== null && !isGenerating && visibleResponses.length > 1;

  // Trigger the slide-out animation one frame after entering selection mode
  useEffect(() => {
    if (!showSelectionMode) {
      setSelectionEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setSelectionEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [showSelectionMode]);

  // Build common panel props
  const buildPanelProps = useCallback(
    (response: MultiModelResponse, isNonPreferred: boolean) => ({
      modelIndex: response.modelIndex,
      provider: response.provider,
      modelName: response.modelName,
      displayName: response.displayName,
      isPreferred: preferredIndex === response.modelIndex,
      isHidden: false as const,
      isNonPreferredInSelection: isNonPreferred,
      onSelect: () => handleSelectPreferred(response.modelIndex),
      onToggleVisibility: () => toggleVisibility(response.modelIndex),
      agentMessageProps: {
        rawPackets: response.packets,
        packetCount: response.packetCount,
        chatState,
        nodeId: response.nodeId,
        messageId: response.messageId,
        currentFeedback: response.currentFeedback,
        llmManager,
        otherMessagesCanSwitchTo,
        onMessageSelection,
        onRegenerate,
        parentMessage,
      },
    }),
    [
      preferredIndex,
      handleSelectPreferred,
      toggleVisibility,
      chatState,
      llmManager,
      otherMessagesCanSwitchTo,
      onMessageSelection,
      onRegenerate,
      parentMessage,
    ]
  );

  // Shared renderer for hidden panels (inline in the flex row)
  const renderHiddenPanels = () =>
    hiddenResponses.map((r) => (
      <MultiModelPanel
        key={r.modelIndex}
        modelIndex={r.modelIndex}
        provider={r.provider}
        modelName={r.modelName}
        displayName={r.displayName}
        isPreferred={false}
        isHidden
        isNonPreferredInSelection={false}
        onSelect={() => handleSelectPreferred(r.modelIndex)}
        onToggleVisibility={() => toggleVisibility(r.modelIndex)}
        agentMessageProps={buildPanelProps(r, false).agentMessageProps}
      />
    ));

  if (showSelectionMode) {
    // ── Selection Layout ──
    // Preferred panel stays centered at normal chat width.
    // Non-preferred panels are in a carousel: they peek from the viewport edges
    // with a fade, and animate in from adjacent to preferred on first render.
    const preferredIdx = visibleResponses.findIndex(
      (r) => r.modelIndex === preferredIndex
    );
    const preferred = visibleResponses[preferredIdx];
    const leftPanels = visibleResponses.slice(0, preferredIdx);
    const rightPanels = visibleResponses.slice(preferredIdx + 1);

    // Peek position: panel's visible edge is at PEEK_W from container edge.
    // right: calc(100% - PEEK_W) → panel's right edge is PEEK_W from container left.
    // left: calc(100% - PEEK_W) → panel's left edge is PEEK_W from container right.
    //
    // Start position (for entry animation): panels start adjacent to the preferred panel
    // and slide out to peek position on the frame after mount.

    const getLeftPanelStyle = (i: number): React.CSSProperties => ({
      width: `${PANEL_W}px`,
      transition: "right 0.45s cubic-bezier(0.2, 0, 0, 1)",
      right: selectionEntered
        ? `calc(100% - ${PEEK_W - i * (PANEL_W + PANEL_GAP)}px)`
        : `calc(50% + 320px + ${PANEL_GAP + i * (PANEL_W + PANEL_GAP)}px)`,
    });

    const getRightPanelStyle = (i: number): React.CSSProperties => ({
      width: `${PANEL_W}px`,
      transition: "left 0.45s cubic-bezier(0.2, 0, 0, 1)",
      left: selectionEntered
        ? `calc(100% - ${PEEK_W - i * (PANEL_W + PANEL_GAP)}px)`
        : `calc(50% + 320px + ${PANEL_GAP + i * (PANEL_W + PANEL_GAP)}px)`,
    });

    return (
      <div
        className="w-full relative overflow-hidden"
        style={{
          // Fade the viewport edges so peeking panels dissolve naturally.
          // Fade zone = PEEK_W px; center is fully opaque (preferred panel unaffected).
          maskImage: `linear-gradient(to right, transparent 0px, black ${PEEK_W}px, black calc(100% - ${PEEK_W}px), transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to right, transparent 0px, black ${PEEK_W}px, black calc(100% - ${PEEK_W}px), transparent 100%)`,
        }}
      >
        {/* Preferred — centered, in normal flow to establish container height */}
        {preferred && (
          <div className="w-full max-w-[640px] min-w-[400px] mx-auto">
            <MultiModelPanel {...buildPanelProps(preferred, false)} />
          </div>
        )}

        {/* Non-preferred on the left — animate from adjacent to peeking */}
        {leftPanels.map((r, i) => (
          <div
            key={r.modelIndex}
            className="absolute top-0"
            style={getLeftPanelStyle(i)}
          >
            <MultiModelPanel {...buildPanelProps(r, true)} />
          </div>
        ))}

        {/* Non-preferred on the right — animate from adjacent to peeking */}
        {rightPanels.map((r, i) => (
          <div
            key={r.modelIndex}
            className="absolute top-0"
            style={getRightPanelStyle(i)}
          >
            <MultiModelPanel {...buildPanelProps(r, true)} />
          </div>
        ))}
      </div>
    );
  }

  // ── Generation Layout (equal panels side-by-side) ──
  return (
    <div className="flex gap-6 items-start justify-center">
      {visibleResponses.map((r) => (
        <div
          key={r.modelIndex}
          className={cn("flex-1 min-w-[400px] max-w-[640px]")}
        >
          <MultiModelPanel {...buildPanelProps(r, false)} />
        </div>
      ))}
      {renderHiddenPanels()}
    </div>
  );
}
