import {
  createProfileRecord,
  deleteProfileByEmail,
  getProfileByEmail,
  hasProfileByEmail,
  updateProfileRecord,
  updateProfileLocaleByEmail,
  updateProfileWardrobeItemsByEmail
} from "./db.js";

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

const wardrobeSeasons = ["spring", "summer", "autumn", "winter"];

const wardrobeAudience = ["man", "woman", "any"];

function normalizeWardrobeAudience(value) {
  const audience = String(value || "").trim().toLowerCase();
  if (audience === "man" || audience === "woman" || audience === "any") {
    return audience;
  }
  return "any";
}

function getStylePreferences() {
  return stylePreferences;
}

function getWardrobeOccasions() {
  return wardrobeOccasions;
}

function getWardrobeSeasons() {
  return wardrobeSeasons;
}

function getWardrobeAudience() {
  return wardrobeAudience;
}

async function getProfile(email) {
  const profile = await getProfileByEmail(email);
  if (!profile) {
    return null;
  }
  return {
    ...profile,
    wardrobeAudience: normalizeWardrobeAudience(profile.wardrobeAudience)
  };
}

async function hasProfile(email) {
  return hasProfileByEmail(email);
}

async function createProfile(email, data) {
  return createProfileRecord({
    email,
    stylePreferences: data.stylePreferences || [],
    wardrobeOccasions: data.wardrobeOccasions || [],
    wardrobeSeasons: data.wardrobeSeasons || [],
    wardrobeAudience: normalizeWardrobeAudience(data.wardrobeAudience),
    locale: data.locale || "en"
  });
}

async function updateProfile(email, data) {
  return updateProfileRecord({
    email,
    stylePreferences: data.stylePreferences || [],
    wardrobeOccasions: data.wardrobeOccasions || [],
    wardrobeSeasons: data.wardrobeSeasons || [],
    wardrobeAudience: normalizeWardrobeAudience(data.wardrobeAudience),
    locale: data.locale || "en"
  });
}

async function updateProfileLocale(email, locale) {
  return updateProfileLocaleByEmail({ email, locale });
}

async function deleteProfile(email) {
  return deleteProfileByEmail(email);
}

async function updateProfileWardrobeItems(email, wardrobeItems) {
  return updateProfileWardrobeItemsByEmail({ email, wardrobeItems });
}

export {
  getProfile,
  hasProfile,
  createProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  updateProfileWardrobeItems,
  getStylePreferences,
  getWardrobeOccasions,
  getWardrobeSeasons,
  getWardrobeAudience
};
