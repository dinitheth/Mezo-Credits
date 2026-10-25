/**
 * One small seam between the app and whatever wallet is connected.
 * Browser wallets use the injected provider; the wallet kit registers
 * itself here after a global wallet connects.
 */
export type WalletAdapter = {
  request?: (args: { method: string; params?: unknown }) => Promise<unknown>;
  sendTransaction: (tx: {
    from: string;
    to: string;
    data: string;
    value?: string;
  }) => Promise<string>;
  signTypedData: (account: string, typed: unknown) => Promise<string>;
  switchNetwork?: (chainId: number) => Promise<void>;
  logout?: () => void | Promise<void>;
};

let adapter: WalletAdapter | null = null;

export function setWalletAdapter(next: WalletAdapter | null) {
  adapter = next;
}

export function getWalletAdapter(): WalletAdapter | null {
  return adapter;
}

/** Ask the connected global wallet to move to another network. */
export async function walletSwitchViaAdapter(chainId: number): Promise<boolean> {
  if (!adapter?.switchNetwork) return false;
  try {
    await adapter.switchNetwork(chainId);
    return true;
  } catch {
    return false;
  }
}
