import { describe, expect, it, vi } from "vitest";
import { switchWalletToMezo } from "@/lib/mezo";

type Call = { method: string; params?: unknown };

function wallet(handler?: (call: Call) => Promise<unknown>) {
  return {
    request: vi.fn(async (call: Call) => (handler ? handler(call) : undefined)),
  };
}

describe("switchWalletToMezo", () => {
  it("switches without adding when the wallet already knows Mezo", async () => {
    const w = wallet();
    await switchWalletToMezo(w);
    expect(w.request).toHaveBeenCalledTimes(1);
    expect(w.request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7b7b" }],
    });
  });

  it("adds Mezo, then switches again when the chain is unknown", async () => {
    let switched = 0;
    const w = wallet(async ({ method }) => {
      if (method === "wallet_switchEthereumChain" && switched++ === 0) {
        throw Object.assign(new Error("Unrecognized chain ID"), { code: 4902 });
      }
    });
    await switchWalletToMezo(w);
    expect(w.request.mock.calls.map(([call]) => call.method)).toEqual([
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
    ]);
    const add = w.request.mock.calls[1]?.[0];
    expect(add?.params).toEqual([
      {
        chainId: "0x7b7b",
        chainName: "Mezo Testnet",
        nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
        rpcUrls: ["https://rpc.test.mezo.org"],
        blockExplorerUrls: ["https://explorer.test.mezo.org"],
      },
    ]);
  });

  it("recognises an unknown-chain message even without an error code", async () => {
    let switched = 0;
    const w = wallet(async ({ method }) => {
      if (method === "wallet_switchEthereumChain" && switched++ === 0) {
        throw new Error("This chain has not been added");
      }
    });
    await switchWalletToMezo(w);
    expect(w.request.mock.calls.map(([call]) => call.method)).toContain("wallet_addEthereumChain");
  });

  it("does not add anything when the person rejects the switch", async () => {
    const w = wallet(async () => {
      throw Object.assign(new Error("User rejected the request"), { code: 4001 });
    });
    await expect(switchWalletToMezo(w)).rejects.toThrow("User rejected the request");
    expect(w.request).toHaveBeenCalledTimes(1);
  });

  it("accepts a wallet that switches as soon as the chain is added", async () => {
    let switched = 0;
    const w = wallet(async ({ method }) => {
      if (method === "wallet_switchEthereumChain") {
        if (switched++ === 0) throw Object.assign(new Error("Unknown chain"), { code: 4902 });
        throw Object.assign(new Error("Already on this chain"), { code: -32602 });
      }
    });
    await expect(switchWalletToMezo(w)).resolves.toBeUndefined();
    expect(w.request.mock.calls.map(([call]) => call.method)).toEqual([
      "wallet_switchEthereumChain",
      "wallet_addEthereumChain",
      "wallet_switchEthereumChain",
    ]);
  });
});
