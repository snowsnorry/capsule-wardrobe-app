export function createProfileDependencies() {
  return {
    createProfileImpl: async (email, payload) => ({
      id: "profile-1",
      email,
      activeCapsuleId: null,
      ...payload,
    }),
    deleteProfileImpl: async () => true,
    getFormalityLevelsImpl: async () => ["casual", "formal"],
    getStylesImpl: async () => ["minimalistic", "sporty"],
    getOccasionsImpl: async () => ["office", "date_night"],
    getSeasonsImpl: async () => ["spring", "summer"],
    getAudienceOptionsImpl: () => ["man", "woman", "any"],
    getPatternOptionsImpl: async () => ["striped", "plain"],
    getProfileImpl: async () => ({
      email: "person@example.com",
      activeCapsuleId: "capsule-1",
      locale: "en",
      fullname: null,
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    }),
    updateProfileImpl: async (email, payload) => ({
      id: "profile-1",
      email,
      activeCapsuleId: "capsule-1",
      ...payload,
    }),
    updateProfileLocaleImpl: async (email, locale) => ({
      id: "profile-1",
      email,
      activeCapsuleId: "capsule-1",
      locale,
      fullname: null,
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    }),
    updateProfileActiveCapsuleIdImpl: async (_email, activeCapsuleId) => ({
      activeCapsuleId,
    }),
  };
}
