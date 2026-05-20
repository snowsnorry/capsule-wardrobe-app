import "@fontsource-variable/onest";
import "./index.css";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { installVitePreloadErrorReload } from "./vitePreloadErrorReload";

const container = document.getElementById("root");

if (!container) {
  throw new Error('Root element "#root" was not found.');
}

const root = createRoot(container);

installVitePreloadErrorReload();

root.render(
  <React.StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </React.StrictMode>,
);
