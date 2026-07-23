import { defaultAppearance, parseAppearanceSettings } from "./appearance.ts";

Deno.test("appearance settings accept known values and reject malformed storage", () => {
  const saved = { scheme: "dark", colorway: "ink" } as const;
  if (
    JSON.stringify(parseAppearanceSettings(JSON.stringify(saved))) !==
      JSON.stringify(saved)
  ) throw new Error("valid appearance settings were not restored");
  if (parseAppearanceSettings('{"scheme":"neon"}') !== defaultAppearance) {
    throw new Error("invalid appearance settings were accepted");
  }
});
