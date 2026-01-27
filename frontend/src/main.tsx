import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TokenProvider } from "./store";
import { ToastProvider } from "./ui/Toast";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TokenProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </TokenProvider>
  </React.StrictMode>
);
