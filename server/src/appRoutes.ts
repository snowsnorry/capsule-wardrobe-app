import { registerPasskeyRoutes } from "./routes/passkeyRoutes.js";
import { registerProfileReadRoutes } from "./routes/profileReadRoutes.js";
import { registerCapsuleReadRoutes } from "./routes/capsuleReadRoutes.js";
import { registerCapsuleMutationRoutes } from "./routes/capsuleMutationRoutes.js";
import { registerOutfitRoutes } from "./routes/outfitRoutes.js";
import { registerSearchRoutes } from "./routes/searchRoutes.js";
import { registerProfileMutationRoutes } from "./routes/profileMutationRoutes.js";
import { registerHealthImageRoutes } from "./routes/healthImageRoutes.js";
import { registerSessionAuthRoutes } from "./routes/sessionAuthRoutes.js";
import { registerWardrobeRoutes } from "./routes/wardrobeRoutes.js";
import { registerLikedItemsRoutes } from "./routes/likedItemsRoutes.js";
import { registerMcpOAuthRoutes } from "./mcp/oauthRoutes.js";
import { registerMcpRoutes } from "./mcp/mcpRoutes.js";

function registerAuthenticationRoutes(app, routeContext) {
  registerSessionAuthRoutes(app, routeContext);
  registerPasskeyRoutes(app, routeContext);
}

function registerDomainRoutes(app, routeContext) {
  registerMcpOAuthRoutes(app, routeContext);
  registerMcpRoutes(app, routeContext);
  registerProfileReadRoutes(app, routeContext);
  registerLikedItemsRoutes(app, routeContext);
  registerWardrobeRoutes(app, routeContext);
  registerCapsuleReadRoutes(app, routeContext);
  registerCapsuleMutationRoutes(app, routeContext);
  registerOutfitRoutes(app, routeContext);
  registerSearchRoutes(app, routeContext);
  registerProfileMutationRoutes(app, routeContext);
  registerHealthImageRoutes(app, routeContext);
}

export function registerAppRoutes(app, routeContext) {
  registerAuthenticationRoutes(app, routeContext);
  registerDomainRoutes(app, routeContext);
}
