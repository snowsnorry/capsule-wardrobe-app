const en = {
  appName: "Capsule Wardrobe",
  marketingHeadline: "Build your personal capsule wardrobe and manage outfits in one place.",
  locale: {
    label: "Language",
    options: {
      en: "English",
      ru: "Russian"
    },
    flags: {
      en: "🇺🇸",
      ru: "🇷🇺"
    }
  },
  options: {
    categories: {
      bottom: "Bottom",
      top: "Top",
      outerwear: "Outerwear",
      shoes: "Shoes",
      belt: "Belt",
      bag: "Bag"
    },
    styles: {
      casual: "Casual",
      formal: "Formal",
      romantic: "Romantic",
      minimal: "Minimal",
      sporty: "Sporty",
      classic: "Classic",
      boho: "Boho",
      streetwear: "Streetwear"
    },
    occasions: {
      office: "Office",
      city_walk: "City walk",
      school_dropoff: "School drop-off",
      party: "Party",
      travel: "Travel",
      weekend: "Weekend",
      date_night: "Date night",
      outdoor: "Outdoor"
    }
  },
  auth: {
    signInTitle: "Sign in",
    signInSubtitleEmail: "Enter your email to receive a sign-in code",
    signInSubtitleCode: "Enter the code from your email to continue",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    sendCode: "Send code",
    emailCodeLabel: "Email code",
    emailCodePlaceholder: "123456",
    verify: "Verify",
    resendCode: "Resend code",
    changeEmail: "Change email",
    tosNotice: "By clicking “Send code”, you agree to the Terms of Service and Privacy Policy.",
    learnMore: "Learn more",
    checkingSession: "Checking session",
    signedIn: "You are signed in.",
    signedOut: "You are signed out.",
    codeSent: "Code sent. It will be valid for {minutes} minutes.",
    orEmailCode: "Or enter your email to receive a sign-in code"
  },
  main: {
    title: "Main",
    welcome: "Welcome back",
    placeholder: "Your profile is ready. The main screen will appear here next.",
    menuOpen: "Open menu",
    menuProfile: "Profile",
    menuSignOut: "Sign out"
  },
  profile: {
    title: "Profile",
    subtitle: "Update your preferences and wardrobe needs.",
    stylesTitle: "Style preferences",
    stylesHint: "Select at least one style.",
    occasionsTitle: "Wardrobe needs",
    occasionsHint: "Select at least one occasion.",
    back: "Back",
    save: "Save changes",
    delete: "Delete profile",
    updated: "Profile updated.",
    deleteConfirmTitle: "Delete profile",
    deleteConfirmBody: "Are you sure you want to delete your profile? This action cannot be undone.",
    deleteConfirmCancel: "Cancel",
    deleteConfirmConfirm: "Delete"
  },
  onboarding: {
    title: "Welcome",
    subtitle: "Let us set up your profile in a few quick steps.",
    step1Title: "Step 1 · Style preferences",
    step1Hint: "Select at least one style that feels like you.",
    step2Title: "Step 2 · Wardrobe needs",
    step2Hint: "Pick the occasions you want your wardrobe to cover.",
    step3Title: "Step 3 · All set",
    step3Hint: "Your profile is ready. You can change these choices anytime in profile settings.",
    next: "Next",
    start: "Start"
  },
  actions: {
    signOut: "Sign out",
    cancel: "Cancel"
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    invalidEmail: "Please check the email format.",
    cooldown: "Please wait a minute before resending.",
    rateLimit: "Too many attempts. Try again later.",
    expired: "The code has expired. Request a new one.",
    maxAttempts: "Too many incorrect attempts.",
    invalidCode: "Invalid code. Please check your email.",
    profileExists: "Profile already exists.",
    profileNotFound: "Profile not found.",
    invalidPayload: "Please select at least one option.",
    invalidGoogleToken: "Google sign-in failed. Please try again.",
    googleAuthNotConfigured: "Google sign-in is not configured on the server."
  },
  dialogs: {
    signOutTitle: "Sign out",
    signOutBody: "Are you sure you want to sign out?",
    signOutCancel: "Cancel",
    signOutConfirm: "Sign out"
  }
};

export default en;
