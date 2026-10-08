import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { searchQueryFn } from "@/lib/api";
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

export const useSearch = (term: string) => {
  const debounced = useDebounced(term.trim());

  const query = useQuery({
    queryKey: queryKeys.search(debounced),
    queryFn: () => searchQueryFn(debounced),
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
