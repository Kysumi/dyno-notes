import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.tsx";
import {
  applyAppearanceSettings,
  readAppearanceSettings,
} from "./lib/appearance.ts";
import "./index.css";

const appearance = readAppearanceSettings();
applyAppearanceSettings(appearance);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App initialAppearance={appearance} />
  </StrictMode>,
);
