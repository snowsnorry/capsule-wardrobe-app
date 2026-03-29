import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider.jsx";

const localeSwitcherMock = vi.hoisted(() => vi.fn(() => <div data-testid="locale-switcher" />));

vi.mock("../components/LocaleSwitcher.jsx", () => ({
  default: localeSwitcherMock
}));

import ProfileScreen from "./ProfileScreen.jsx";

const theme = createTheme();

function renderScreen(props = {}, { locale = "en" } = {}) {
  window.localStorage.setItem("locale", locale);

  const defaults = {
    styleOptions: {
      core: ["casual", "formal"],
      aesthetics: ["minimalistic", "retro"]
    },
    occasionOptions: ["office", "date_night"],
    seasonOptions: ["summer", "winter"],
    audienceOptions: ["woman", "man"],
    accentColorOptions: ["blue", "red"],
    patternOptions: ["solid", "stripe"],
    selectedStyleCore: "casual",
    selectedStyleAesthetic: null,
    selectedOccasions: ["office"],
    selectedSeasons: ["summer"],
    selectedAudience: "woman",
    selectedAccentColor: null,
    selectedPattern: null,
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    onSelectStyleCore: vi.fn(),
    onSelectStyleAesthetic: vi.fn(),
    onToggleOccasion: vi.fn(),
    onToggleSeason: vi.fn(),
    onSelectAudience: vi.fn(),
    onSelectAccentColor: vi.fn(),
    onSelectPattern: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onBack: vi.fn()
  };

  return {
    ...defaults,
    ...props,
    ...render(
      <ThemeProvider theme={theme}>
        <LocaleProvider>
          <ProfileScreen {...defaults} {...props} />
        </LocaleProvider>
      </ThemeProvider>
    )
  };
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    cleanup();
    localeSwitcherMock.mockClear();
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  test("saves and goes back when selections are complete", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onBack = vi.fn();

    renderScreen({
      onSave,
      onBack
    });

    const saveButton = screen.getByRole("button", { name: "Save changes" });
    expect(saveButton).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);

    await user.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test("gates save until required selections are present", () => {
    renderScreen({
      selectedStyleCore: "",
      selectedOccasions: [],
      selectedSeasons: [],
      selectedAudience: ""
    });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  test("updates style, occasion, season, audience, accent color, and pattern selections", async () => {
    const user = userEvent.setup();
    const onSelectStyleCore = vi.fn();
    const onSelectStyleAesthetic = vi.fn();
    const onToggleOccasion = vi.fn();
    const onToggleSeason = vi.fn();
    const onSelectAudience = vi.fn();
    const onSelectAccentColor = vi.fn();
    const onSelectPattern = vi.fn();

    renderScreen({
      onSelectStyleCore,
      onSelectStyleAesthetic,
      onToggleOccasion,
      onToggleSeason,
      onSelectAudience,
      onSelectAccentColor,
      onSelectPattern
    }, { locale: "ru" });

    await user.click(screen.getByRole("button", { name: "Официальный" }));
    await user.click(screen.getByRole("button", { name: "Минималистичный" }));
    await user.click(screen.getByRole("button", { name: "Офис" }));
    await user.click(screen.getByRole("button", { name: "Зима" }));
    await user.click(screen.getByRole("button", { name: "Мужчина" }));
    await user.click(screen.getByRole("button", { name: "Синий" }));
    await user.click(screen.getByRole("button", { name: "Полоска" }));

    expect(onSelectStyleCore).toHaveBeenCalledWith("formal");
    expect(onSelectStyleAesthetic).toHaveBeenCalledWith("minimalistic");
    expect(onToggleOccasion).toHaveBeenCalledWith("office");
    expect(onToggleSeason).toHaveBeenCalledWith("winter");
    expect(onSelectAudience).toHaveBeenCalledWith("man");
    expect(onSelectAccentColor).toHaveBeenCalledWith("blue");
    expect(onSelectPattern).toHaveBeenCalledWith("stripe");
    expect(screen.getByText("Профиль")).toBeInTheDocument();
  });

  test("opens delete confirmation and only calls delete after confirmation", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    renderScreen({ onDelete });

    await user.click(screen.getByRole("button", { name: "Delete profile" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Delete profile")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete profile" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("shows loading, error, and info states and disables destructive actions while loading", () => {
    renderScreen({
      status: {
        loading: true,
        error: "something went wrong",
        infoKey: "profile.updated",
        infoParams: null
      }
    });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete profile" })).toBeDisabled();
    expect(screen.getByText("something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Profile updated.")).toBeInTheDocument();
  });
});
