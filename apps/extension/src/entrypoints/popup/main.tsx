import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

document.documentElement.classList.add("dark");

const root = document.getElementById("root");
if (!root) {
  throw new Error("Popup root element missing");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
