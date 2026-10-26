import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initNativePlatform } from "./platform/native";
import "./index.css";
import "./styles/variables.css";

// Mantine styles — required for dark mode and component theming to work
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

// Initialize the native window (title) and start the app boot sequence.
// No-op outside a Neutralino window.
void initNativePlatform();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
