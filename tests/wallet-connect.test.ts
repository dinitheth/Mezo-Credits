import { beforeEach, describe, expect, it, vi } from "vitest";

const ADDR = "0x5555555555555555555555555555555555555555";

type Request = (args: { method: string; params?: unknown }) => Promise<unknown>;

function browserWallet(request: Request) {
  return {
    request: vi.fn(request),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
}

function walletWith(accounts: string[], chainId = "0x7b7b") {
  return browserWallet(async ({ method }) => {
    if (method === "eth_accounts" || method === "eth_requestAccounts") return accounts;
    if (method === "eth_chainId") return chainId;
    throw new Error(`Unexpected wallet call: ${method}`);
  });
}

async function freshStore() {
  vi.resetModules();
  return import("@/lib/mezo");
}

function setProvider(provider: ReturnType<typeof browserWallet>) {
  (window as unknown as { ethereum: unknown }).ethereum = provider;
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  delete (window as unknown as { ethereum?: unknown }).ethereum;
});

describe("connecting and leaving", () => {
  it("uses the first account and current chain when connecting", async () => {
    const { connectWallet, getState } = await freshStore();
    setProvider(walletWith([ADDR, "0x6666666666666666666666666666666666666666"]));

    await connectWallet();

    expect(getState().account).toBe(ADDR);
    expect(getState().chainId).toBe(31611);
  });
});

describe("switching networks", () => {
  it("asks the wallet to switch to Mezo", async () => {
    const { connectWallet, switchToMezo, getState } = await freshStore();
    const provider = walletWith([ADDR]);
    let chain = "0x1";
    provider.request.mockImplementation(async ({ method }) => {
      if (method === "eth_requestAccounts") return [ADDR];
      if (method === "eth_chainId") return chain;
      if (method === "wallet_switchEthereumChain") {
        chain = "0x7b7b";
        return null;
      }
      throw new Error(method);
    });
    setProvider(provider);

    await connectWallet();
    expect(getState().chainId).toBe(1);

    await switchToMezo();
    expect(getState().chainId).toBe(31611);
    expect(provider.request).toHaveBeenCalledWith({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x7b7b" }],
    });
  });

  it("adds Mezo when the wallet does not know it yet", async () => {
    const { switchToMezo, getState } = await freshStore();
    let switched = 0;
    const provider = browserWallet(async ({ method }) => {
      if (method === "wallet_switchEthereumChain") {
        if (switched++ === 0) throw Object.assign(new Error("Unrecognized chain"), { code: 4902 });
        return null;
      }
      if (method === "wallet_addEthereumChain") return null;
      if (method === "eth_chainId") return "0x7b7b";
      throw new Error(method);
    });
    setProvider(provider);

    await switchToMezo();

    expect(provider.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "wallet_addEthereumChain",
        params: [
          expect.objectContaining({
            chainId: "0x7b7b",
            chainName: "Mezo Testnet",
            rpcUrls: ["https://rpc.test.mezo.org"],
          }),
        ],
      }),
    );
    expect(getState().chainId).toBe(31611);
  });

  it("does not pretend a rejected switch worked", async () => {
    const { switchToMezo, getState } = await freshStore();
    const provider = browserWallet(async ({ method }) => {
      if (method === "wallet_switchEthereumChain") {
        throw Object.assign(new Error("User rejected the request."), { code: 4001 });
      }
      throw new Error(method);
    });
    setProvider(provider);

    await expect(switchToMezo()).rejects.toMatchObject({ code: 4001 });
    expect(getState().chainId).toBeNull();
  });
});
