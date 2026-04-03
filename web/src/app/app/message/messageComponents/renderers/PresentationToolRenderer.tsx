import React, { useEffect, useMemo } from "react";
import { SvgFileChartPie } from "@opal/icons";
import {
  PacketType,
  PresentationToolPacket,
  PresentationToolFinal,
  SectionEnd,
} from "../../../services/streamingModels";
import { MessageRenderer, RenderType } from "../interfaces";
import { Text } from "@opal/components";

function constructPresentationState(packets: PresentationToolPacket[]) {
  const hasStart = packets.some(
    (p) => p.obj.type === PacketType.PRESENTATION_TOOL_START
  );
  const finalPacket = packets.find(
    (p) => p.obj.type === PacketType.PRESENTATION_TOOL_FINAL
  )?.obj as PresentationToolFinal | undefined;
  const hasEnd = packets.some(
    (p) =>
      p.obj.type === PacketType.SECTION_END ||
      p.obj.type === PacketType.ERROR
  );

  return {
    isGenerating: hasStart && !finalPacket && !hasEnd,
    isComplete: hasStart && (!!finalPacket || hasEnd),
    finalData: finalPacket ?? null,
  };
}

export const PresentationToolRenderer: MessageRenderer<
  PresentationToolPacket,
  {}
> = ({ packets, onComplete, renderType, children }) => {
  const { isGenerating, isComplete, finalData } =
    constructPresentationState(packets);

  useEffect(() => {
    if (isComplete) {
      onComplete();
    }
  }, [isComplete]);

  const status = useMemo(() => {
    if (isComplete && finalData) {
      return `Generated presentation (${finalData.slides_count} slide${finalData.slides_count !== 1 ? "s" : ""})`;
    }
    if (isGenerating) {
      return "Generating presentation...";
    }
    return null;
  }, [isComplete, isGenerating, finalData]);

  if (renderType === RenderType.FULL) {
    if (isGenerating) {
      return children([
        {
          icon: SvgFileChartPie,
          status: "Generating presentation...",
          supportsCollapsible: false,
          content: (
            <div className="flex items-center gap-2 p-4">
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 bg-text-03 rounded-full animate-pulse" />
                <div
                  className="w-1.5 h-1.5 bg-text-03 rounded-full animate-pulse"
                  style={{ animationDelay: "0.15s" }}
                />
                <div
                  className="w-1.5 h-1.5 bg-text-03 rounded-full animate-pulse"
                  style={{ animationDelay: "0.3s" }}
                />
              </div>
              <Text font="main-ui-body" color="text-03">
                Generating presentation...
              </Text>
            </div>
          ),
        },
      ]);
    }

    if (isComplete && finalData) {
      return children([
        {
          icon: SvgFileChartPie,
          status: `Generated presentation (${finalData.slides_count} slide${finalData.slides_count !== 1 ? "s" : ""})`,
          supportsCollapsible: false,
          content: (
            <div className="flex flex-col gap-3 p-4 rounded-lg border border-border-02 bg-background-neutral-01">
              <div className="flex items-center gap-2">
                <SvgFileChartPie className="w-5 h-5 text-text-03" />
                <Text font="main-ui-action" color="text-01">
                  {finalData.filename}
                </Text>
                <span className="rounded-full bg-background-tint-02 px-2 py-0.5">
                  <Text font="secondary-body" color="text-03">
                    {`${finalData.slides_count} slide${finalData.slides_count !== 1 ? "s" : ""}`}
                  </Text>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={finalData.view_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-action-link-01 px-3 py-1.5 text-text-inverted-01 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <SvgFileChartPie className="w-4 h-4" />
                  View Presentation
                </a>
                {finalData.download_url && (
                  <a
                    href={finalData.download_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border-02 bg-background-neutral-01 px-3 py-1.5 text-text-01 text-sm font-medium hover:bg-background-neutral-02 transition-colors"
                  >
                    Download
                  </a>
                )}
              </div>
            </div>
          ),
        },
      ]);
    }

    return children([
      {
        icon: SvgFileChartPie,
        status,
        supportsCollapsible: false,
        content: <div />,
      },
    ]);
  }

  // Compact / Highlight rendering
  if (isComplete && finalData) {
    return children([
      {
        icon: SvgFileChartPie,
        status: `Generated presentation (${finalData.slides_count} slide${finalData.slides_count !== 1 ? "s" : ""})`,
        supportsCollapsible: false,
        content: (
          <Text font="main-ui-body" color="text-03">
            {`Generated presentation (${finalData.slides_count} slide${finalData.slides_count !== 1 ? "s" : ""})`}
          </Text>
        ),
      },
    ]);
  }

  if (isGenerating) {
    return children([
      {
        icon: SvgFileChartPie,
        status: "Generating presentation...",
        supportsCollapsible: false,
        content: (
          <Text font="main-ui-body" color="text-03">
            Generating presentation...
          </Text>
        ),
      },
    ]);
  }

  return children([
    {
      icon: SvgFileChartPie,
      status: "Presentation",
      supportsCollapsible: false,
      content: (
        <Text font="main-ui-body" color="text-03">
          Presentation
        </Text>
      ),
    },
  ]);
};
