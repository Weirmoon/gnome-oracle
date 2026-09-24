import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { usePathname } from "./shims/navigation";
import "../app/globals.css";
import "../app/background.css";
import { BackgroundProvider } from "../components/background/BackgroundProvider";
import "./native.css";

const pages = import.meta.glob<{ default: React.ComponentType }>("../app/**/page.tsx");
const routes = Object.fromEntries(Object.entries(pages).map(([file, loader]) => [file.replace(/^\.\.\/app/, "").replace(/\/page\.tsx$/, "") || "/", lazy(loader)]));
function App() {
  const pathname = usePathname();
  const direct = routes[pathname];
  const pattern = direct || Object.entries(routes).find(([route]) => {
    const pattern = route.replace(/\[[^/]+\]/g, "[^/]+");
    return new RegExp(`^${pattern}$`).test(pathname);
  })?.[1];
  const Page = pattern || routes["/"];
  return <Suspense fallback={<main className="wrap"><p role="status">Opening the oracle…</p></main>}><Page /></Suspense>;
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><BackgroundProvider><App /></BackgroundProvider></React.StrictMode>);
