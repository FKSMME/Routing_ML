import "./index.css";
import "reactflow/dist/style.css";

import { registerResponsiveLayout } from "@styles/responsive";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";

registerResponsiveLayout();

const rootElement = document.getElementById("root") as HTMLElement;

const render = (node: React.ReactNode) => {
  ReactDOM.createRoot(rootElement).render(<React.StrictMode>{node}</React.StrictMode>);
};

if (import.meta.env.DEV && window.location.hash === "#rule-badge-demo") {
  import("./devpages/RuleBadgeDemo").then(({ RuleBadgeDemo }) => {
    render(<RuleBadgeDemo />);
  });
} else {
  const queryClient = new QueryClient();
  import("./App").then(({ default: App }) => {
    render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>,
    );
  });
}


