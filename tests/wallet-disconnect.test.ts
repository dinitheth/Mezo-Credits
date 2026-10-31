import { beforeEach, describe, expect, it, vi } from "vitest";
import { disconnectWallet, getState, setState } from "@/lib/mezo";
import { setWalletAdapter } from "@/lib/wallet-adapter";

const ADDR = "0x5555555555555555555555555555555555555555";

describe("disconnecting a wallet", () => {
  beforeEach(() => {
    localStorage.clear();
    setWalletAdapter(null);
    setState({ account: null, chainId: null });
  });

  it("clears the wallet", () => {
    setState({ account: ADDR, chainId: 31611 });
    expect(getState().account).toBe(ADDR);

    disconnectWallet();

    expect(getState().account).toBeNull();
    expect(getState().chainId).toBeNull();
  });

  it("asks the wallet kit to log out", () => {
    const logout = vi.fn(async () => {});
    setWalletAdapter({
      sendTransaction: async () => "0x",
      signTypedData: async () => "0x",
      logout,
    });

    disconnectWallet();

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it("survives a wallet kit that refuses to log out", () => {
    setWalletAdapter({
      sendTransaction: async () => "0x",
      signTypedData: async () => "0x",
      logout: () => Promise.reject(new Error("no session")),
    });

    expect(() => disconnectWallet()).not.toThrow();
    expect(getState().account).toBeNull();
    setWalletAdapter(null);
  });
});
