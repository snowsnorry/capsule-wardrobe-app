import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider.jsx";

const localeSwitcherMock = vi.hoisted(() => vi.fn(() => <div data-testid="locale-switcher" />));

vi.mock("../components/LocaleSwitcher.jsx", () => ({
  default: localeSwitcherMock
}));

import OnboardingScreen from "./OnboardingScreen.jsx";

const theme = createTheme();

function renderScreen(props = {}, { locale = "en" } = {}) {
  window.localStorage.setItem("locale", locale);

  const defaults = {
    onboardingStep: 0,
    styleOptions: {
      core: ["casual", "formal"],
      aesthetics: ["minimalistic", "retro"]
    },
    occasionOptions: ["office", "date_night"],
    seasonOptions: ["summer", "winter"],
    audienceOptions: ["woman", "man"],
    selectedStyleCore: "",
    selectedStyleAesthetic: null,
    selectedOccasions: [],
    selectedSeasons: [],
    selectedAudience: "",
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
    onToggleOccasion: vi.fn(),
    onToggleSeason: vi.fn(),
    onSelectAudience: vi.fn(),
    onNext: vi.fn(),
    onBack: vi.fn(),
    onFinish: vi.fn()
  };

  const renderResult = render(
    <ThemeProvider theme={theme}>
      <LocaleProvider>
        <OnboardingScreen {...defaults} {...props} />
      </LocaleProvider>
    </ThemeProvider>
  );

  return {
    ...defaults,
    ...props,
    ...renderResult
  };
}

describe("OnboardingScreen", () => {
  beforeEach(() => {
    cleanup();
    localeSwitcherMock.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test("gates step 1 next until a core style is selected", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onSelectStyleCore = vi.fn();
    const onSelectStyleAesthetic = vi.fn();

    renderScreen({
      selectedStyleCore: "",
      onNext,
      onSelectStyleCore,
      onSelectStyleAesthetic
    });

    expect(screen.getByText("Step 1 · Style preferences")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Formal" }));
    await user.click(screen.getByRole("button", { name: "Minimalistic" }));

    expect(onSelectStyleCore).toHaveBeenCalledWith("formal");
    expect(onSelectStyleAesthetic).toHaveBeenCalledWith("minimalistic");
  });

  test("steps 2 and 3 keep next disabled until required selections are present", async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    const onToggleOccasion = vi.fn();
    const onToggleSeason = vi.fn();

    const { rerender } = renderScreen({
      onboardingStep: 1,
      selectedStyleCore: "casual",
      selectedOccasions: [],
      onNext,
      onToggleOccasion,
      onToggleSeason
    });

    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Office" }));
    expect(onToggleOccasion).toHaveBeenCalledWith("office");

    rerender(
      <ThemeProvider theme={theme}>
        <LocaleProvider>
          <OnboardingScreen
            onboardingStep={2}
            styleOptions={{ core: ["casual"], aesthetics: ["minimalistic"] }}
            occasionOptions={["office"]}
            seasonOptions={["summer", "winter"]}
            audienceOptions={["woman", "man"]}
            selectedStyleCore="casual"
            selectedStyleAesthetic={null}
            selectedOccasions={["office"]}
            selectedSeasons={[]}
            selectedAudience=""
            status={{ loading: false, error: "", infoKey: "", infoParams: null }}
            onSelectStyleCore={vi.fn()}
            onSelectStyleAesthetic={vi.fn()}
            onToggleOccasion={onToggleOccasion}
            onToggleSeason={onToggleSeason}
            onSelectAudience={vi.fn()}
            onNext={onNext}
            onBack={vi.fn()}
            onFinish={vi.fn()}
          />
        </LocaleProvider>
      </ThemeProvider>
    );

    expect(screen.getByText("Step 3 · Seasons")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Winter" }));
    expect(onToggleSeason).toHaveBeenCalledWith("winter");

    rerender(
      <ThemeProvider theme={theme}>
        <LocaleProvider>
          <OnboardingScreen
            onboardingStep={2}
            styleOptions={{ core: ["casual"], aesthetics: ["minimalistic"] }}
            occasionOptions={["office"]}
            seasonOptions={["summer", "winter"]}
            audienceOptions={["woman", "man"]}
            selectedStyleCore="casual"
            selectedStyleAesthetic={null}
            selectedOccasions={["office"]}
            selectedSeasons={["winter"]}
            selectedAudience=""
            status={{ loading: false, error: "", infoKey: "", infoParams: null }}
            onSelectStyleCore={vi.fn()}
            onSelectStyleAesthetic={vi.fn()}
            onToggleOccasion={onToggleOccasion}
            onToggleSeason={onToggleSeason}
            onSelectAudience={vi.fn()}
            onNext={onNext}
            onBack={vi.fn()}
            onFinish={vi.fn()}
          />
        </LocaleProvider>
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  test("step 4 shows start button and requires audience selection", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    const onSelectAudience = vi.fn();
    const onBack = vi.fn();

    const { rerender } = renderScreen({
      onboardingStep: 3,
      selectedStyleCore: "casual",
      selectedOccasions: ["office"],
      selectedSeasons: ["summer"],
      selectedAudience: "",
      onFinish,
      onSelectAudience,
      onBack
    });

    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Woman" }));
    expect(onSelectAudience).toHaveBeenCalledWith("woman");

    rerender(
      <ThemeProvider theme={theme}>
        <LocaleProvider>
          <OnboardingScreen
            onboardingStep={3}
            styleOptions={{
              core: ["casual", "formal"],
              aesthetics: ["minimalistic", "retro"]
            }}
            occasionOptions={["office", "date_night"]}
            seasonOptions={["summer", "winter"]}
            audienceOptions={["woman", "man"]}
            selectedStyleCore="casual"
            selectedStyleAesthetic={null}
            selectedOccasions={["office"]}
            selectedSeasons={["summer"]}
            selectedAudience="woman"
            status={{ loading: false, error: "", infoKey: "", infoParams: null }}
            onSelectStyleCore={vi.fn()}
            onSelectStyleAesthetic={vi.fn()}
            onToggleOccasion={vi.fn()}
            onToggleSeason={vi.fn()}
            onSelectAudience={onSelectAudience}
            onNext={vi.fn()}
            onBack={onBack}
            onFinish={onFinish}
          />
        </LocaleProvider>
      </ThemeProvider>
    );

    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  test("back button calls the provided handler on intermediate steps", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    renderScreen({
      onboardingStep: 2,
      selectedStyleCore: "casual",
      selectedOccasions: ["office"],
      selectedSeasons: ["summer"],
      onBack
    });

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  test("shows error and info messages when present", () => {
    renderScreen({
      status: {
        loading: false,
        error: "something went wrong",
        infoKey: "onboarding.completedHint",
        infoParams: null
      }
    });

    expect(screen.getByText("something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Your profile is ready. You can change these choices anytime in profile settings.")).toBeInTheDocument();
  });
});
