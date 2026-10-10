import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { requestItemMutationFn, searchQueryFn, type DeliveryCatalogue } from "@/lib/api";
import { queryKeys } from "@/lib/query-client";

/** Waits for a pause in typing so every keystroke is not a request. */
const useDebounced = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);

    return () => clearTimeout(timer);
  }, [delay, value]);

  return debounced;
};

export const useSearch = (term: string, mode: DeliveryCatalogue = "grocery") => {
  const debounced = useDebounced(term.trim());

  const query = useQuery({
    queryKey: queryKeys.search(debounced, mode),
    // The mode is passed so a search that finds nothing is recorded against the
    // right catalogue: "sushi" wanted in food is a different thing to stock
    // from "sushi" wanted in groceries.
    queryFn: () => searchQueryFn(debounced, mode),
    enabled: debounced.length > 0,
    select: (response) => response.data,
  });

  return {
    ...query,
    /** True while the user is still typing ahead of the debounce. */
    isTyping: term.trim() !== debounced,
    term: debounced,
  };
};

/**
 * Asks us to stock something we do not sell.
 *
 * The deliberate version of the search that found nothing — which is why it is
 * counted separately: a tap on "we want this" is a decision, a search may have
 * been a typo.
 */
export const useRequestItem = () => useMutation({ mutationFn: requestItemMutationFn });
