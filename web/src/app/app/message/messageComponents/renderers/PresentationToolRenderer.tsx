import React, { useEffect, useMemo, useState } from "react";
import { SvgFileChartPie, SvgExternalLink, SvgMaximize2 } from "@opal/icons";
import {
  PacketType,
  PresentationToolPacket,
  PresentationToolFinal,
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
  const [expanded, setExpanded] = useState(false);

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
      const iframeHeight = expanded ? "80vh" : "400px";

      return children([
        {
          icon: SvgFileChartPie,
          status: `Generated presentation (${finalData.slides_count} slide${finalData.slides_count !== 1 ? "s" : ""})`,
          supportsCollapsible: false,
          content: (
            <div className="flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-3">
                <div className="flex items-center gap-2">
                  <SvgFileChartPie className="w-5 h-5 text-text-03" />
                  <Text font="main-ui-action" color="text-01">
                    {finalData.filename.replace(/\.html$/, "").replace(/_/g, " ").replace(/ \d{8} \d{6}$/, "")}
                  </Text>
                  <span className="rounded-full bg-background-tint-02 px-2 py-0.5">
                    <Text font="secondary-body" color="text-03">
                      {`${finalData.slides_count} slides`}
                    </Text>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-03 hover:bg-background-neutral-02 transition-colors"
                    title={expanded ? "Collapse" : "Expand"}
                  >
                    <SvgMaximize2 className="w-4 h-4" />
                  </button>
                  <a
                    href={finalData.view_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-03 hover:bg-background-neutral-02 transition-colors"
                    title="Open in new tab"
                  >
                    <SvgExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Embedded preview */}
              <div
                className="rounded-lg overflow-hidden border border-border-02 mx-4 mb-3"
                style={{ height: iframeHeight, transition: "height 0.3s ease" }}
              >
                <iframe
                  src={finalData.view_url}
                  className="w-full h-full border-0"
                  title="Presentation preview"
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 px-4 pb-3">
                <a
                  href={finalData.view_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md bg-action-link-01 px-3 py-1.5 text-text-inverted-01 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <SvgExternalLink className="w-4 h-4" />
                  Open Full Screen
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
