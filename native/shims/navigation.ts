import { useSyncExternalStore } from "react";

function subscribe(notify: () => void) {
  window.addEventListener("popstate", notify);
  return () => window.removeEventListener("popstate", notify);
}
export function navigate(href: string, replace = false) {
  if (replace) history.replaceState(null, "", href);
  else history.pushState(null, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.scrollTo(0, 0);
}
export function usePathname() { return useSyncExternalStore(subscribe, () => location.pathname, () => "/"); }
export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => location.search, () => "");
  return new URLSearchParams(search);
}
export function useRouter() { return { push: navigate, replace: (href: string) => navigate(href, true), back: () => history.back(), refresh: () => location.reload() }; }
export function useParams<T extends Record<string, string> = Record<string, string>>() {
  const path = usePathname();
  const parts = path.split("/").filter(Boolean);
  return { id: parts[parts.length - 1] ?? "" } as unknown as T;
}
