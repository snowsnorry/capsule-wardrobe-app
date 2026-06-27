import {
  createAuthDependencies,
  createPasskeyDependencies,
} from "./serverRouteTestAuthDependencies.js";
import { createCapsuleDependencies } from "./serverRouteTestCapsuleDependencies.js";
import { createMcpOAuthDependencies } from "./serverRouteTestMcpOAuthDependencies.js";
import { createProfileDependencies } from "./serverRouteTestProfileDependencies.js";
import { createSearchAndGenerationDependencies } from "./serverRouteTestSearchDependencies.js";
import type { DependencyOverrides } from "./serverRouteTestTypes.js";
import { createWardrobeDependencies } from "./serverRouteTestWardrobeDependencies.js";
import { createInMemoryJobService } from "../jobs/inMemoryJobService.js";

export function createDependencies(overrides: DependencyOverrides = {}) {
  return {
    ...createAuthDependencies(),
    ...createPasskeyDependencies(),
    ...createProfileDependencies(),
    ...createCapsuleDependencies(),
    ...createSearchAndGenerationDependencies(),
    ...createMcpOAuthDependencies(),
    ...createWardrobeDependencies(),
    ...createInMemoryJobService(),
    clearAccountTransientStateImpl: async () => undefined,
    ...overrides,
  };
}
