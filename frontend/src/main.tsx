import "./index.css";
import "reactflow/dist/style.css";

import { registerResponsiveLayout } from "@styles/responsive";
import { applyTheme } from "@styles/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";


const queryClient = new QueryClient();

applyTheme();
registerResponsiveLayout();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);


