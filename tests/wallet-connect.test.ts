import { beforeEach, describe, expect, it, vi } from "vitest";

const ADDR = "0x5555555555555555555555555555555555555555";
const MANUAL_KEY = "mezoflow_manual_disconnect";

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

describe("quiet reconnect", () => {
  it("restores a wallet the browser already approved", async () => {
    const { restoreWallet, getState } = await freshStore();
    const provider = walletWith([ADDR]);
    setProvider(provider);

    await expect(restoreWallet()).resolves.toBe(true);
    expect(getState().account).toBe(ADDR);
    expect(getState().chainId).toBe(31611);
    expect(provider.request).toHaveBeenCalledWith({ method: "eth_accounts" });
    expect(localStorage.getItem("mezoflow_last_wallet")).toBe(ADDR);
  });

  it("does nothing after the person chose to disconnect", async () => {
    const { restoreWallet, isManualDisconnected } = await freshStore();
    localStorage.setItem(MANUAL_KEY, "1");
    const provider = walletWith([ADDR]);
    setProvider(provider);

    await expect(restoreWallet()).resolves.toBe(false);
    expect(isManualDisconnected()).toBe(true);
    expect(provider.request).not.toHaveBeenCalled();
  });

  it("tries the next installed wallet when one refuses", async () => {
    const { restoreWallet, getState } = await freshStore();
    const refusing = browserWallet(async () => {
      throw new Error("refused");
    });
    const working = walletWith([ADDR]);
    (window as unknown as { ethereum: unknown }).ethereum = {
      request: refusing.request,
      on: vi.fn(),
      removeListener: vi.fn(),
      providers: [refusing, working],
    };

    await expect(restoreWallet()).resolves.toBe(true);
    expect(getState().account).toBe(ADDR);
  });
});

describe("connecting and leaving", () => {
  it("remembers the manual disconnect across refreshes", async () => {
    const { connectWallet, disconnectWallet, restoreWallet, getState } = await freshStore();
    const provider = walletWith([ADDR]);
    setProvider(provider);

    await connectWallet();
    expect(getState().account).toBe(ADDR);

    disconnectWallet();
    expect(getState().account).toBeNull();
    expect(localStorage.getItem(MANUAL_KEY)).toBe("1");
    await expect(restoreWallet()).resolves.toBe(false);
  });

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
    provider.request.mockImplementation(async ({ method }) => {
      if (method === "eth_requestAccounts") return [ADDR];
      if (method === "eth_chainId") return "0x1";
      if (method === "wallet_switchEthereumChain") return null;
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
    const provider = browserWallet(async ({ method }) => {
      if (method === "wallet_switchEthereumChain") {
        throw Object.assign(new Error("Unrecognized chain"), { code: 4902 });
      }
      if (method === "wallet_addEthereumChain") return null;
      throw new Error(method);
    });
    setProvider(provider);

    await switchToMezo();

    expect(provider.request).toHaveBeenCalledTimes(2);
    expect(provider.request).toHaveBeenLastCalledWith(
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
