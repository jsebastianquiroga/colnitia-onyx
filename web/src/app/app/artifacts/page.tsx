"use client";

import React, { useState, useCallback } from "react";
import useSWR, { mutate } from "swr";
import { Text } from "@opal/components";
import { Button } from "@opal/components/buttons/button/components";
import {
  SvgFileChartPie,
  SvgTrash,
  SvgExternalLink,
  SvgShare,
  SvgEdit,
} from "@opal/icons";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import ArtifactModal from "@/components/mobile/ArtifactModal";
import useScreenSize from "@/hooks/useScreenSize";
import InputTypeIn from "@/refresh-components/inputs/InputTypeIn";
import InputSelect from "@/refresh-components/inputs/InputSelect";

interface ArtifactVersion {
  id: string;
  version_number: number;
  file_size: number | null;
  created_at: string;
}

interface ArtifactItem {
  id: string;
  user_id: string;
  artifact_type: string;
  title: string;
  description: string | null;
  current_version: number;
  is_public: boolean;
  shared_with_workspace: boolean;
  created_at: string;
  updated_at: string;
  versions?: ArtifactVersion[];
}

const SWR_KEY = "/api/artifacts";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ArtifactCard({
  artifact,
  onRefresh,
}: {
  artifact: ArtifactItem;
  onRefresh: () => void;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(artifact.title);
  const [deleting, setDeleting] = useState(false);

  const patchArtifact = useCallback(
    async (body: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/artifacts/${artifact.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          console.error("Failed to update artifact", await res.text());
        }
      } catch (e) {
        console.error("Failed to update artifact", e);
      }
      onRefresh();
    },
    [artifact.id, onRefresh]
  );

  const handleRename = useCallback(async () => {
    if (!editTitle.trim() || editTitle === artifact.title) {
      setEditing(false);
      return;
    }
    await patchArtifact({ title: editTitle });
    setEditing(false);
  }, [editTitle, artifact.title, patchArtifact]);

  const handleToggleShare = useCallback(async () => {
    await patchArtifact({
      shared_with_workspace: !artifact.shared_with_workspace,
    });
  }, [artifact.shared_with_workspace, patchArtifact]);

  const handleTogglePublic = useCallback(async () => {
    await patchArtifact({ is_public: !artifact.is_public });
  }, [artifact.is_public, patchArtifact]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Are you sure you want to delete this artifact?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/artifacts/${artifact.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error("Failed to delete artifact", await res.text());
      }
    } catch (e) {
      console.error("Failed to delete artifact", e);
    }
    onRefresh();
  }, [artifact.id, onRefresh]);

  return (
    <>
      <div
        className={cn(
          "rounded-lg border border-border-02 bg-background-neutral-01 p-4",
          "flex flex-col gap-3 hover:border-border-03 transition-colors cursor-pointer"
        )}
        onClick={() => setPreviewOpen(true)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <SvgFileChartPie className="w-5 h-5 text-text-03 shrink-0" />
            <div className="flex flex-col gap-0.5">
              {editing ? (
                <div onClick={(e) => e.stopPropagation()}>
                  <InputTypeIn
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleRename}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRename();
                      if (e.key === "Escape") setEditing(false);
                    }}
                    autoFocus
                  />
                </div>
              ) : (
                <Text font="main-ui-action" color="text-01">
                  {artifact.title}
                </Text>
              )}
              <Text font="secondary-body" color="text-03">
                {formatDate(artifact.updated_at)}
              </Text>
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            {artifact.shared_with_workspace && (
              <span className="rounded-full bg-background-tint-02 px-2 py-0.5">
                <Text font="secondary-body" color="text-03">
                  Shared
                </Text>
              </span>
            )}
            {artifact.is_public && (
              <span className="rounded-full bg-status-success-01 px-2 py-0.5">
                <Text font="secondary-body" color="text-01">
                  Public
                </Text>
              </span>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-1 pt-1 border-t border-border-01"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="default"
            prominence="tertiary"
            size="2xs"
            icon={SvgEdit}
            onClick={() => setEditing(true)}
            tooltip="Rename"
          />
          <Button
            variant="default"
            prominence="tertiary"
            size="2xs"
            icon={SvgShare}
            onClick={handleToggleShare}
            tooltip={
              artifact.shared_with_workspace
                ? "Unshare from workspace"
                : "Share with workspace"
            }
          />
          <Button
            variant="default"
            prominence="tertiary"
            size="2xs"
            icon={SvgExternalLink}
            onClick={handleTogglePublic}
            tooltip={artifact.is_public ? "Make private" : "Make public"}
          />
          <Button
            variant="danger"
            prominence="tertiary"
            size="2xs"
            icon={SvgTrash}
            onClick={handleDelete}
            disabled={deleting}
            tooltip="Delete"
          />
        </div>
      </div>

      <ArtifactModal open={previewOpen} onClose={() => setPreviewOpen(false)}>
        <iframe
          src={`/api/artifacts/${artifact.id}/content`}
          className="w-full h-full border-0"
          title={artifact.title}
          sandbox="allow-scripts allow-same-origin"
        />
      </ArtifactModal>
    </>
  );
}

export default function ArtifactsPage() {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { isMobile } = useScreenSize();

  const queryParams = new URLSearchParams();
  if (typeFilter) queryParams.set("artifact_type", typeFilter);
  const swrKey = `${SWR_KEY}?${queryParams.toString()}`;

  const { data: artifacts, isLoading } = useSWR<ArtifactItem[]>(
    swrKey,
    errorHandlingFetcher
  );

  const handleRefresh = useCallback(() => {
    mutate(swrKey);
  }, [swrKey]);

  return (
    <div className="flex flex-col w-full h-full overflow-auto">
      <div className="p-6 pb-4 flex items-center justify-between">
        <Text font="heading-h2" color="text-01" as="h2">
          Artifacts
        </Text>
        <div className="flex items-center gap-2">
          <InputSelect
            value={typeFilter || "all"}
            onValueChange={(val) => setTypeFilter(val === "all" ? "" : val)}
          >
            <InputSelect.Trigger placeholder="All types" />
            <InputSelect.Content>
              <InputSelect.Item value="all">All types</InputSelect.Item>
              <InputSelect.Item value="presentation">
                Presentations
              </InputSelect.Item>
              <InputSelect.Item value="web_app">Web Apps</InputSelect.Item>
              <InputSelect.Item value="image">Images</InputSelect.Item>
              <InputSelect.Item value="markdown">Markdown</InputSelect.Item>
            </InputSelect.Content>
          </InputSelect>
        </div>
      </div>

      <div className="px-6 pb-6 flex-1">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Text font="main-ui-body" color="text-03">
              Loading artifacts...
            </Text>
          </div>
        ) : !artifacts || artifacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 gap-2">
            <SvgFileChartPie className="w-12 h-12 text-text-03 opacity-40" />
            <Text font="main-ui-body" color="text-03">
              No artifacts yet. Generate a presentation in chat to get started.
            </Text>
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-4",
              isMobile
                ? "grid-cols-1"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            )}
          >
            {artifacts.map((artifact) => (
              <ArtifactCard
                key={artifact.id}
                artifact={artifact}
                onRefresh={handleRefresh}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
