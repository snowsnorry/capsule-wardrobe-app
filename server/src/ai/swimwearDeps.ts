import { getSqlClient } from "../db.js";
import {
  getGenerateJsonWithLlm,
  isNoLlmProfileEnabled,
  resolveLlmProvider,
} from "./llm.js";

type SwimwearGenerateJsonWithLlm = (
  prompt: string,
  options: Record<string, unknown>,
) => Promise<{
  response?: { output_text?: unknown; usage?: unknown };
  json?: Record<string, unknown> | null;
}>;

type SwimwearLlmProviderResolution = {
  fallbackReason?: unknown;
  llm?: unknown;
  model?: string | null;
  provider?: string | null;
  requestedLlm?: unknown;
};

export type SwimwearDeps = {
  getSqlClientImpl: typeof getSqlClient;
  getGenerateJsonWithLlmImpl: (
    userProfile: unknown,
  ) => SwimwearGenerateJsonWithLlm;
  isNoLlmProfileEnabledImpl: (userProfile: unknown) => boolean;
  resolveLlmProviderImpl: (
    userProfile: unknown,
  ) => SwimwearLlmProviderResolution;
};

export type SwimwearDepsOverrides = {
  getSqlClientImpl?: unknown;
  getGenerateJsonWithLlmImpl?: SwimwearDeps["getGenerateJsonWithLlmImpl"];
  isNoLlmProfileEnabledImpl?: SwimwearDeps["isNoLlmProfileEnabledImpl"];
  resolveLlmProviderImpl?: SwimwearDeps["resolveLlmProviderImpl"];
};

export function createSwimwearDeps(
  deps: SwimwearDepsOverrides = {},
): SwimwearDeps {
  return {
    getSqlClientImpl:
      (deps.getSqlClientImpl as SwimwearDeps["getSqlClientImpl"]) ||
      getSqlClient,
    getGenerateJsonWithLlmImpl:
      deps.getGenerateJsonWithLlmImpl || getGenerateJsonWithLlm,
    isNoLlmProfileEnabledImpl:
      deps.isNoLlmProfileEnabledImpl || isNoLlmProfileEnabled,
    resolveLlmProviderImpl: deps.resolveLlmProviderImpl || resolveLlmProvider,
  };
}
