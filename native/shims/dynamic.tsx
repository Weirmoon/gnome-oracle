import { lazy, Suspense, type ComponentType } from "react";

export default function dynamic<P extends object>(loader: () => Promise<{ default: ComponentType<P> } | ComponentType<P>>, options?: { ssr?: boolean; loading?: ComponentType }) {
  const Lazy = lazy(async () => {
    const loaded = await loader();
    return { default: typeof loaded === "function" ? loaded : (loaded as { default: ComponentType<P> }).default };
  });
  const Loading = options?.loading;
  return function Dynamic(props: P) {
    return <Suspense fallback={Loading ? <Loading /> : null}><Lazy {...props} /></Suspense>;
  };
}
