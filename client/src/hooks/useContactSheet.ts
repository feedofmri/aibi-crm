import { useCallback } from "react";
import { useSearchParams } from "react-router";

/**
 * The open contact lives in the URL (?contact=<id>) so it works on every page,
 * survives a refresh and can be shared as a link.
 */
export function useContactSheet() {
  const [params, setParams] = useSearchParams();
  const contactId = params.get("contact");

  const open = useCallback(
    (id: string) =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.set("contact", id);
        return next;
      }),
    [setParams],
  );

  const close = useCallback(
    () =>
      setParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("contact");
        return next;
      }),
    [setParams],
  );

  return { contactId, open, close };
}
