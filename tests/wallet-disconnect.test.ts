import { beforeEach, describe, expect, it } from "vitest";
import {
  clearManualDisconnect,
  disconnectWallet,
  getState,
  isManualDisconnected,
  restoreWallet,
  setState,
} from "@/lib/mezo";
import { setWalletAdapter } from "@/lib/wallet-adapter";

const ADDR = "0x5555555555555555555555555555555555555555";

describe("disconnecting a wallet", () => {
  beforeEach(() => {
    localStorage.clear();
    clearManualDisconnect();
    setWalletAdapter(null);
    setState({ account: null, chainId: null });
  });

  it("clears the wallet and remembers the choice", () => {
    setState({ account: ADDR, chainId: 31611 });
    expect(getState().account).toBe(ADDR);

    disconnectWallet();

    expect(getState().account).toBeNull();
    expect(getState().chainId).toBeNull();
    expect(isManualDisconnected()).toBe(true);
  });

  it("keeps quiet reconnect off until the person connects again", async () => {
    disconnectWallet();
    expect(await restoreWallet()).toBe(false);

    clearManualDisconnect();
    expect(isManualDisconnected()).toBe(false);
  });

  it("survives a wallet kit that refuses to log out", () => {
    setWalletAdapter({
      sendTransaction: async () => "0x",
      signTypedData: async () => "0x",
      logout: () => Promise.reject(new Error("no session")),
    });

    expect(() => disconnectWallet()).not.toThrow();
    expect(isManualDisconnected()).toBe(true);
    setWalletAdapter(null);
  });
});
