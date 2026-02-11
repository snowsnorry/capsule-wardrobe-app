import {
  createProfileRecord,
  deleteProfileByEmail,
  getProfileByEmail,
  hasProfileByEmail,
  updateProfileRecord,
  updateProfileLocaleByEmail
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

function getStylePreferences() {
  return stylePreferences;
}

function getWardrobeOccasions() {
  return wardrobeOccasions;
}

async function getProfile(email) {
  return getProfileByEmail(email);
}

async function hasProfile(email) {
  return hasProfileByEmail(email);
}

async function createProfile(email, data) {
  return createProfileRecord({
    email,
    stylePreferences: data.stylePreferences || [],
    wardrobeOccasions: data.wardrobeOccasions || [],
    locale: data.locale || "en"
  });
}

async function updateProfile(email, data) {
  return updateProfileRecord({
    email,
    stylePreferences: data.stylePreferences || [],
    wardrobeOccasions: data.wardrobeOccasions || [],
    locale: data.locale || "en"
  });
}

async function updateProfileLocale(email, locale) {
  return updateProfileLocaleByEmail({ email, locale });
}

async function deleteProfile(email) {
  return deleteProfileByEmail(email);
}

export {
  getProfile,
  hasProfile,
  createProfile,
  updateProfile,
  updateProfileLocale,
  deleteProfile,
  getStylePreferences,
  getWardrobeOccasions
};
