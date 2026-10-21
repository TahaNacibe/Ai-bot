import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./renderer.css";
import "./local-ai.css";
import App from "./App.tsx";
import Layout from "./components/Layout.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <Layout>
        <App />
      </Layout>
    </HashRouter>
  </StrictMode>,
);
