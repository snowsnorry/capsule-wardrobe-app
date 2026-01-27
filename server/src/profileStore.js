const profiles = new Map();

const stylePreferences = [
  "casual",
  "formal",
  "romantic",
  "minimal",
  "sporty",
  "classic",
  "boho",
  "streetwear"
];

const wardrobeOccasions = [
  "office",
  "city_walk",
  "school_dropoff",
  "party",
  "travel",
  "weekend",
  "date_night",
  "outdoor"
];

function getProfile(email) {
  return profiles.get(email) || null;
}

function hasProfile(email) {
  return profiles.has(email);
}

function createProfile(email, data) {
  const profile = {
    email,
    stylePreferences: data.stylePreferences || [],
    wardrobeOccasions: data.wardrobeOccasions || [],
    createdAt: new Date().toISOString()
  };
  profiles.set(email, profile);
  return profile;
}

function updateProfile(email, data) {
  const existing = profiles.get(email);
  if (!existing) {
    return null;
  }
  const profile = {
    ...existing,
    stylePreferences: data.stylePreferences || [],
    wardrobeOccasions: data.wardrobeOccasions || [],
    updatedAt: new Date().toISOString()
  };
  profiles.set(email, profile);
  return profile;
}

function deleteProfile(email) {
  return profiles.delete(email);
}

function getStylePreferences() {
  return stylePreferences;
}

function getWardrobeOccasions() {
  return wardrobeOccasions;
}

export {
  getProfile,
  hasProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  getStylePreferences,
  getWardrobeOccasions
};
