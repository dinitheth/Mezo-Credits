import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
function matchesFor(url: string) {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  return router.matchRoutes(url);
}

describe("App routing", () => {
  it.each([
    "/",
    "/borrow",
    "/earn",
    "/pay",
    "/checkout",
    "/dashboard",
    "/activity",
    "/how-it-works",
  ])("matches a real page for %s", (url) => {
    const matches = matchesFor(url);
    const leaf = matches.at(-1);

    expect(leaf?.routeId).not.toBe(rootRouteId);
    expect(leaf?.pathname).toBe(url.split("?")[0]);
  });
});
