export const colorways = [
  { id: "spruce", name: "Spruce", swatch: "bg-emerald-800" },
  { id: "ink", name: "Ink", swatch: "bg-blue-700" },
  { id: "aubergine", name: "Aubergine", swatch: "bg-violet-700" },
  { id: "clay", name: "Clay", swatch: "bg-orange-700" },
  { id: "graphite", name: "Graphite", swatch: "bg-stone-700" },
] as const;

export type Colorway = (typeof colorways)[number]["id"];
export type ColorScheme = "light" | "dark" | "system";

export interface AppearanceSettings {
  scheme: ColorScheme;
  colorway: Colorway;
}

export const defaultAppearance: AppearanceSettings = {
  scheme: "system",
  colorway: "spruce",
};

const STORAGE_KEY = "dyno.appearance.v1";
const schemes: ColorScheme[] = ["light", "dark", "system"];

export function parseAppearanceSettings(
  value: string | null,
): AppearanceSettings {
  if (!value) return defaultAppearance;
  try {
    const parsed = JSON.parse(value);
    return schemes.includes(parsed?.scheme) &&
      colorways.some(({ id }) => id === parsed?.colorway)
      ? parsed
      : defaultAppearance;
  } catch {
    return defaultAppearance;
  }
}

export function readAppearanceSettings(): AppearanceSettings {
  return typeof localStorage === "undefined"
    ? defaultAppearance
    : parseAppearanceSettings(localStorage.getItem(STORAGE_KEY));
}

export function saveAppearanceSettings(settings: AppearanceSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyAppearanceSettings(settings: AppearanceSettings): void {
  const dark =
    settings.scheme === "dark" ||
    (settings.scheme === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.colorway = settings.colorway;
}
