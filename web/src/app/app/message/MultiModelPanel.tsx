"use client";

import { useCallback } from "react";
import { Button } from "@opal/components";
import { SvgEyeClosed, SvgX } from "@opal/icons";
import Text from "@/refresh-components/texts/Text";
import { getProviderIcon } from "@/app/admin/configuration/llm/utils";
import AgentMessage, {
  AgentMessageProps,
} from "@/app/app/message/messageComponents/AgentMessage";
import { Section } from "@/layouts/general-layouts";
import { cn } from "@/lib/utils";

export interface MultiModelPanelProps {
  modelIndex: number;
  /** Provider name for icon lookup */
  provider: string;
  /** Model name for icon lookup and display */
  modelName: string;
  /** Display-friendly model name */
  displayName: string;
  /** Whether this panel is the preferred/selected response */
  isPreferred: boolean;
  /** Whether this panel is currently hidden */
  isHidden: boolean;
  /** Whether this is a non-preferred panel in selection mode (pushed off-screen) */
  isNonPreferredInSelection: boolean;
  /** Callback when user clicks this panel to select as preferred */
  onSelect: () => void;
  /** Callback to hide/show this panel */
  onToggleVisibility: () => void;
  /** Props to pass through to AgentMessage */
  agentMessageProps: AgentMessageProps;
}

export default function MultiModelPanel({
  modelIndex,
  provider,
  modelName,
  displayName,
  isPreferred,
  isHidden,
  isNonPreferredInSelection,
  onSelect,
  onToggleVisibility,
  agentMessageProps,
}: MultiModelPanelProps) {
  const ProviderIcon = getProviderIcon(provider, modelName);

  const handlePanelClick = useCallback(() => {
    if (!isHidden) onSelect();
  }, [isHidden, onSelect]);

  // Hidden/collapsed panel — compact strip at fixed 220px
  if (isHidden) {
    return (
      <div className="flex items-center gap-1.5 w-[220px] shrink-0 rounded-08 bg-background-tint-00 px-2 py-1 opacity-50 hover:opacity-100 transition-opacity cursor-pointer">
        <div className="flex items-center justify-center size-5 shrink-0">
          <ProviderIcon size={16} />
        </div>
        <Text
          secondaryBody
          text02
          nowrap
          className="line-through flex-1 min-w-0 truncate"
        >
          {displayName}
        </Text>
        <Button
          prominence="tertiary"
          icon={SvgEyeClosed}
          size="2xs"
          onClick={onToggleVisibility}
          tooltip="Show response"
        />
      </div>
    );
  }

  return (
    <Section
      flexDirection="column"
      alignItems="stretch"
      justifyContent="start"
      height="fit"
      gap={0.75}
      className={cn(
        "min-w-0 cursor-pointer rounded-16 transition-colors",
        !isPreferred && "hover:bg-background-tint-02"
      )}
      onClick={handlePanelClick}
    >
      {/* Panel header */}
      <Section
        flexDirection="row"
        alignItems="center"
        justifyContent="start"
        height="fit"
        gap={0.375}
        className={cn(
          "rounded-12 px-2 py-1",
          isPreferred ? "bg-background-tint-02" : "bg-background-tint-00"
        )}
      >
        <div className="flex items-center justify-center size-5 shrink-0">
          <ProviderIcon size={16} />
        </div>
        <Text mainUiAction text04 nowrap className="flex-1 min-w-0 truncate">
          {displayName}
        </Text>
        {isPreferred && (
          <Text secondaryBody nowrap className="text-action-link-05 shrink-0">
            Preferred Response
          </Text>
        )}
        <Button
          prominence="tertiary"
          icon={SvgX}
          size="2xs"
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility();
          }}
          tooltip="Hide response"
        />
      </Section>

      {/* Response body */}
      <div className={cn(isNonPreferredInSelection && "pointer-events-none")}>
        <AgentMessage
          {...agentMessageProps}
          hideFooter={isNonPreferredInSelection}
        />
      </div>
    </Section>
  );
}
