import type { AnchorHTMLAttributes } from "react";
import { navigate } from "./navigation";

export default function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && href.startsWith("/") && props.target !== "_blank") {
      event.preventDefault(); navigate(href);
    }
  }} />;
}
