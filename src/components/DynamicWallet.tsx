import { useEffect, useState, type ComponentType, type ReactNode } from "react";

import { dynamicWalletEnabled } from "@/lib/wallet-adapter";

/**
 * Loads the global wallet kit in the browser only, and only when its
 * environment ID is configured. Without an environment ID the app keeps
 * its built-in wallet flow.
 */
export function DynamicWalletRoot({ children }: { children: ReactNode }) {
  const [Inner, setInner] = useState<ComponentType<{ children: ReactNode }> | null>(null);
  useEffect(() => {
    if (!dynamicWalletEnabled) return;
    let live = true;
    void import("./DynamicWalletInner").then((m) => {
      if (live) setInner(() => m.DynamicWalletInner);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!dynamicWalletEnabled || !Inner) return <>{children}</>;
  return <Inner>{children}</Inner>;
}

/** Connect button slot for the header; shows `fallback` until the kit loads. */
export function DynamicConnectArea({ fallback }: { fallback: ReactNode }) {
  const [Comp, setComp] = useState<ComponentType | null>(null);
  useEffect(() => {
    if (!dynamicWalletEnabled) return;
    let live = true;
    void import("./DynamicWalletInner").then((m) => {
      if (live) setComp(() => m.DynamicConnectArea);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!dynamicWalletEnabled || !Comp) return <>{fallback}</>;
  return <Comp />;
}
