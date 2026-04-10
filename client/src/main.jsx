import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "./index.css";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { LocaleProvider } from "./i18n/LocaleProvider.jsx";

const root = createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </React.StrictMode>
);
