import {
  createDeleteProfileHandler,
  createInitializeProfileHandler,
  createUpdateProfileHandler,
  createUpdateProfileLocaleHandler,
} from "./profileMutationHandlers.js";

export function registerProfileMutationRoutes(app, context) {
  const {
    createProfileImpl,
    clearAccountTransientStateImpl,
    deleteR2ObjectsImpl,
    deleteProfileImpl,
    listWardrobeItemsImpl,
    normalizeProfileSettingsPayload,
    nodeEnv,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
    toProfileResponse,
    updateProfileImpl,
    updateProfileLocaleImpl,
  } = context;

  app.post(
    "/profile/initialize",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    createInitializeProfileHandler({ createProfileImpl, toProfileResponse }),
  );

  app.patch(
    "/profile/me",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    createUpdateProfileHandler({
      normalizeProfileSettingsPayload,
      toProfileResponse,
      updateProfileImpl,
    }),
  );

  app.patch(
    "/profile/locale",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    createUpdateProfileLocaleHandler({
      toProfileResponse,
      updateProfileLocaleImpl,
    }),
  );

  app.delete(
    "/profile/me",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    createDeleteProfileHandler({
      clearAccountTransientStateImpl,
      deleteProfileImpl,
      deleteR2ObjectsImpl,
      listWardrobeItemsImpl,
      nodeEnv,
    }),
  );
}
