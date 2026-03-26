"use client";

import { useState } from "react";
import MultiModelResponseView from "@/app/app/message/MultiModelResponseView";
import type { MultiModelResponse } from "@/app/app/message/interfaces";
import ModelSelector, {
  SelectedModel,
} from "@/refresh-components/popovers/ModelSelector";
import { Packet, StopReason } from "@/app/app/services/streamingModels";
import { FullChatState } from "@/app/app/message/messageComponents/interfaces";
import type { LlmManager } from "@/lib/hooks";
import type { LLMProviderDescriptor } from "@/interfaces/llm";

// ────────────────────────────────────────────────────────────
// Mock data
// ────────────────────────────────────────────────────────────

function makeTextPackets(text: string): Packet[] {
  return [
    {
      placement: { turn_index: 0 },
      obj: {
        type: "message_start" as const,
        id: "msg-1",
        content: "",
        final_documents: null,
      },
    },
    {
      placement: { turn_index: 0 },
      obj: { type: "message_delta" as const, content: text },
    },
    {
      placement: { turn_index: 0 },
      obj: { type: "message_end" as const },
    },
    {
      placement: { turn_index: 0 },
      obj: { type: "stop" as const, stop_reason: StopReason.FINISHED },
    },
  ];
}

const mockChatState: FullChatState = {
  agent: {
    id: 0,
    name: "Test Agent",
    description: "",
    tools: [],
    starter_messages: null,
    document_sets: [],
    is_public: true,
    is_listed: false,
    display_priority: null,
    is_featured: false,
    builtin_persona: true,
    owner: null,
  },
};

const PACKETS = {
  anthropic: makeTextPackets(
    "**Claude Opus 4.6** here.\n\nThe universe is fundamentally beautiful. Every particle dances to the rhythm of quantum fields, and consciousness itself may be the universe observing itself through our eyes.\n\nI recommend we consider both the mathematical elegance and the philosophical implications."
  ),
  openai: makeTextPackets(
    "**GPT-4o** here.\n\nLet me break this down systematically:\n\n1. First, analyze the core problem\n2. Evaluate available options\n3. Select the optimal solution based on criteria\n\nThis structured approach ensures comprehensive coverage."
  ),
  google: makeTextPackets(
    "**Gemini Pro** here.\n\nInteresting question! Based on my analysis, there are multiple valid perspectives to consider. The key insight is that context matters enormously—what works in one situation may not work in another."
  ),
};

const mockProviders: LLMProviderDescriptor[] = [
  {
    id: 1,
    name: "anthropic",
    provider: "anthropic",
    provider_display_name: "Anthropic",
    model_configurations: [
      {
        name: "claude-opus-4-6",
        display_name: "Claude Opus 4.6",
        is_visible: true,
        max_input_tokens: 200000,
        supports_image_input: true,
        supports_reasoning: true,
      },
      {
        name: "claude-sonnet-4-6",
        display_name: "Claude Sonnet 4.6",
        is_visible: true,
        max_input_tokens: 200000,
        supports_image_input: true,
        supports_reasoning: false,
      },
    ],
  },
  {
    id: 2,
    name: "openai",
    provider: "openai",
    provider_display_name: "OpenAI",
    model_configurations: [
      {
        name: "gpt-4o",
        display_name: "GPT-4o",
        is_visible: true,
        max_input_tokens: 128000,
        supports_image_input: true,
        supports_reasoning: false,
      },
      {
        name: "gpt-4o-mini",
        display_name: "GPT-4o Mini",
        is_visible: true,
        max_input_tokens: 128000,
        supports_image_input: false,
        supports_reasoning: false,
      },
    ],
  },
  {
    id: 3,
    name: "google",
    provider: "google",
    provider_display_name: "Google",
    model_configurations: [
      {
        name: "gemini-pro",
        display_name: "Gemini Pro",
        is_visible: true,
        max_input_tokens: 1000000,
        supports_image_input: true,
        supports_reasoning: false,
      },
    ],
  },
];

const mockLlmManager = {
  llmProviders: mockProviders,
  currentLlm: {
    name: "claude-opus-4-6",
    provider: "anthropic",
    modelName: "claude-opus-4-6",
  },
  isLoadingProviders: false,
} as unknown as LlmManager;

// ────────────────────────────────────────────────────────────
// All 3 responses (constant — we always pass all 3 to the view)
// ────────────────────────────────────────────────────────────

function buildResponses(generating: boolean): MultiModelResponse[] {
  return [
    {
      modelIndex: 0,
      provider: "anthropic",
      modelName: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
      packets: generating ? PACKETS.anthropic.slice(0, 2) : PACKETS.anthropic,
      packetCount: generating ? 2 : PACKETS.anthropic.length,
      nodeId: 1,
      messageId: 1,
      isGenerating: generating,
    },
    {
      modelIndex: 1,
      provider: "openai",
      modelName: "gpt-4o",
      displayName: "GPT-4o",
      packets: generating ? [] : PACKETS.openai,
      packetCount: generating ? 0 : PACKETS.openai.length,
      nodeId: 2,
      messageId: 2,
      isGenerating: generating,
    },
    {
      modelIndex: 2,
      provider: "google",
      modelName: "gemini-pro",
      displayName: "Gemini Pro",
      packets: generating ? [] : PACKETS.google,
      packetCount: generating ? 0 : PACKETS.google.length,
      nodeId: 3,
      messageId: 3,
      isGenerating: generating,
    },
  ];
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export default function MultiModelPreviewPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelCount, setModelCount] = useState<2 | 3>(2);

  // Selector state (independent from the response view)
  const [selectedModels, setSelectedModels] = useState<SelectedModel[]>([
    {
      name: "claude-opus-4-6",
      provider: "anthropic",
      modelName: "claude-opus-4-6",
      displayName: "Claude Opus 4.6",
    },
    {
      name: "gpt-4o",
      provider: "openai",
      modelName: "gpt-4o",
      displayName: "GPT-4o",
    },
  ]);

  const allResponses = buildResponses(isGenerating);
  const visibleResponses = allResponses.slice(0, modelCount);

  return (
    <div className="min-h-screen bg-background-neutral-01">
      {/* Top bar */}
      <div className="sticky top-0 z-50 flex items-center gap-6 px-8 py-3 bg-background-tint-01 border-b border-border-01">
        <span className="text-text-04 font-semibold text-sm">
          Multi-Model Preview
        </span>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isGenerating}
            onChange={(e) => setIsGenerating(e.target.checked)}
            className="w-4 h-4 accent-action-link-05"
          />
          <span className="text-text-03 text-sm">Generating</span>
        </label>

        <div className="flex items-center gap-2">
          <span className="text-text-03 text-sm">Panels:</span>
          {([2, 3] as const).map((n) => (
            <button
              key={n}
              onClick={() => setModelCount(n)}
              className={`px-2 py-0.5 rounded text-sm transition-colors ${
                modelCount === n
                  ? "bg-action-link-01 text-action-link-03 font-semibold"
                  : "text-text-03 hover:bg-background-tint-02"
              }`}
            >
              {n}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="text-text-03 text-xs">
          Click a panel to select preferred · X to hide · eye to restore
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-8 py-8 space-y-12">
        {/* ── Section 1: Model Selector ── */}
        <section className="space-y-3">
          <div className="text-xs font-semibold text-text-03 uppercase tracking-widest">
            Model Selector (input bar)
          </div>
          <div className="inline-flex bg-background-tint-01 rounded-12 border border-border-01">
            <ModelSelector
              llmManager={mockLlmManager}
              selectedModels={selectedModels}
              onAdd={(model) => setSelectedModels((prev) => [...prev, model])}
              onRemove={(index) =>
                setSelectedModels((prev) => prev.filter((_, i) => i !== index))
              }
              onReplace={(index, model) =>
                setSelectedModels((prev) => {
                  const next = [...prev];
                  next[index] = model;
                  return next;
                })
              }
            />
          </div>
        </section>

        {/* ── Section 2: Response View ── */}
        <section className="space-y-3">
          <div className="text-xs font-semibold text-text-03 uppercase tracking-widest">
            Response View ({modelCount} models ·{" "}
            {isGenerating ? "generating" : "complete"})
          </div>
          <MultiModelResponseView
            responses={visibleResponses}
            chatState={mockChatState}
            llmManager={null}
          />
        </section>
      </div>
    </div>
  );
}
