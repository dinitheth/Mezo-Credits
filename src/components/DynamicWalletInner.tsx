import { useEffect, useRef, type ReactNode } from "react";
import { DynamicContextProvider, useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors, isEthereumWallet } from "@dynamic-labs/ethereum";

import { Btn } from "./ui-bits";
import { setState } from "@/lib/mezo";
import { DYNAMIC_ENV_ID, setWalletAdapter } from "@/lib/wallet-adapter";

/** The signer needs big integers for number fields; raw wallet calls take strings. */
function normalizeTyped(typed: unknown): unknown {
  const t = typed as {
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    domain: Record<string, unknown>;
    message: Record<string, unknown>;
  };
  const types = { ...t.types };
  delete types["EIP712Domain"];
  const message = { ...t.message };
  for (const field of types[t.primaryType] ?? []) {
    const v = message[field.name];
    if (/^u?int\d*$/.test(field.type) && v !== undefined && typeof v !== "bigint") {
      message[field.name] = BigInt(v as string | number);
    }
  }
  const domain = { ...t.domain };
  const cid = domain["chainId"];
  if (typeof cid === "string") domain["chainId"] = BigInt(cid);
  return { ...t, domain, types, message };
}

/** Keeps the app store in step with the connected wallet, and wires up writes. */
function WalletSync() {
  const { primaryWallet, sdkHasLoaded } = useDynamicContext();
  const syncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sdkHasLoaded) return;
    if (!primaryWallet) {
      if (syncedRef.current) {
        syncedRef.current = null;
        setWalletAdapter(null);
        setState({ account: null });
      }
      return;
    }
    const address = primaryWallet.address;
    setState({ account: address });
    if (!isEthereumWallet(primaryWallet)) {
      setWalletAdapter(null);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const wc = await primaryWallet.getWalletClient();
        const chainId = await wc.getChainId();
        if (!live) return;
        setState({ chainId });
        syncedRef.current = address;
        const flexible = wc as unknown as {
          sendTransaction: (args: {
            to: `0x${string}`;
            data: `0x${string}`;
            value?: bigint | undefined;
          }) => Promise<string>;
          signTypedData: (args: unknown) => Promise<string>;
        };
        setWalletAdapter({
          sendTransaction: (tx) =>
            flexible.sendTransaction({
              to: tx.to as `0x${string}`,
              data: tx.data as `0x${string}`,
              value: tx.value === undefined ? undefined : BigInt(tx.value),
            }),
          signTypedData: (_account, typed) => flexible.signTypedData(normalizeTyped(typed)),
          switchNetwork: (id) => wc.switchChain({ id }),
        });
      } catch {
        // Wallet is still spinning up; reads keep working through the public network.
      }
    })();
    return () => {
      live = false;
    };
  }, [primaryWallet, sdkHasLoaded]);

  return null;
}

function ConnectButton() {
  const { setShowAuthFlow } = useDynamicContext();
  return <Btn onClick={() => setShowAuthFlow(true)}>Connect wallet</Btn>;
}

export function DynamicConnectArea() {
  return <ConnectButton />;
}

export function DynamicWalletInner({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        appName: "MezoFlow",
        useMetamaskSdk: false,
        walletConnectors: [EthereumWalletConnectors],
        walletsFilter: (wallets) =>
          wallets.filter((w) => !/coinbase/i.test(w.key) && !/coinbase/i.test(w.name)),
        siweStatement:
          "Sign in to MezoFlow. This proves you own this wallet and does not move any money.",
      }}
    >
      <WalletSync />
      {children}
    </DynamicContextProvider>
  );
}
