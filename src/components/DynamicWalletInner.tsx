import { useEffect, useRef, type ReactNode } from "react";
import {
  DynamicContextProvider,
  mergeNetworks,
  useDynamicContext,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors, isEthereumWallet } from "@dynamic-labs/ethereum";
import { defineChain } from "viem";

import { Btn } from "./ui-bits";
import { MEZO, setState, short, switchWalletToMezo } from "@/lib/mezo";
import { DYNAMIC_ENV_ID, setWalletAdapter } from "@/lib/wallet-adapter";

/** Mezo networks, for wallet calls that need a chain attached. */
const MEZO_CHAINS = {
  31611: defineChain({
    id: 31611,
    name: "Mezo Testnet",
    nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
    blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
    testnet: true,
  }),
  31612: defineChain({
    id: 31612,
    name: "Mezo",
    nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
    rpcUrls: { default: { http: ["https://rpc.mainnet.mezo.org"] } },
    blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.mezo.org" } },
  }),
} as const;

type MezoChain = (typeof MEZO_CHAINS)[keyof typeof MEZO_CHAINS];

const DYNAMIC_MEZO_NETWORK = {
  blockExplorerUrls: [MEZO.explorer],
  chainId: MEZO.chainId,
  chainName: MEZO.name,
  iconUrls: ["/favicon.png"],
  name: MEZO.name,
  nativeCurrency: { decimals: 18, name: "Bitcoin", symbol: "BTC" },
  networkId: MEZO.chainId,
  rpcUrls: [MEZO.rpc],
  vanityName: MEZO.name,
  isTestnet: true,
};

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
  const { primaryWallet, handleLogOut } = useDynamicContext();
  const syncedRef = useRef<string | null>(null);
  const logoutRef = useRef(handleLogOut);
  useEffect(() => {
    logoutRef.current = handleLogOut;
  }, [handleLogOut]);

  useEffect(() => {
    if (!primaryWallet) {
      if (syncedRef.current) {
        syncedRef.current = null;
        setWalletAdapter(null);
        setState({ account: null });
      }
      return;
    }
    const address = primaryWallet.address;
    setState({ account: address, chainId: null });
    if (!isEthereumWallet(primaryWallet)) {
      setWalletAdapter(null);
      return;
    }
    let live = true;
    void (async () => {
      try {
        const wc = await primaryWallet.getWalletClient();
        let chainId = await wc.getChainId();
        if (!live) return;
        const flexible = wc as unknown as {
          sendTransaction: (args: {
            chain?: MezoChain;
            to: `0x${string}`;
            data: `0x${string}`;
            value?: bigint | undefined;
          }) => Promise<string>;
          signTypedData: (args: unknown) => Promise<string>;
          request: (args: { method: string; params?: unknown }) => Promise<unknown>;
        };
        if (!live) return;
        setState({ chainId });
        syncedRef.current = address;
        setWalletAdapter({
          sendTransaction: async (tx) => {
            const chain = MEZO_CHAINS[chainId as keyof typeof MEZO_CHAINS] ?? MEZO_CHAINS[31611];
            return flexible.sendTransaction({
              chain,
              to: tx.to as `0x${string}`,
              data: tx.data as `0x${string}`,
              value: tx.value === undefined ? undefined : BigInt(tx.value),
            });
          },
          signTypedData: (_account, typed) => flexible.signTypedData(normalizeTyped(typed)),
          switchNetwork: async (id) => {
            if (id === MEZO.chainId) {
              try {
                await primaryWallet.switchNetwork(id);
                chainId = await wc.getChainId();
                if (chainId !== id) await switchWalletToMezo(flexible);
              } catch (e) {
                if (isUserRejection(e)) throw e;
                await switchWalletToMezo(flexible);
              }
            } else {
              try {
                await wc.switchChain({ id });
              } catch {
                await flexible.request({
                  method: "wallet_switchEthereumChain",
                  params: [{ chainId: `0x${id.toString(16)}` }],
                });
              }
            }
            chainId = await wc.getChainId();
            if (chainId !== id) throw new Error("Your wallet did not switch networks.");
          },
          logout: () => logoutRef.current(),
        });
      } catch {
        // Wallet is still spinning up; reads keep working through the public network.
      }
    })();
    return () => {
      live = false;
    };
  }, [primaryWallet]);

  return null;
}

function ConnectButton({ remembered }: { remembered?: string | null | undefined }) {
  const { setShowAuthFlow } = useDynamicContext();
  return (
    <Btn onClick={() => setShowAuthFlow(true)}>
      {remembered ? `Reconnect ${short(remembered)}` : "Connect wallet"}
    </Btn>
  );
}

export function DynamicConnectArea({ remembered }: { remembered?: string | null | undefined }) {
  return <ConnectButton remembered={remembered} />;
}

export function DynamicWalletInner({ children }: { children: ReactNode }) {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: DYNAMIC_ENV_ID,
        appName: "MezoFlow",
        useMetamaskSdk: false,
        walletConnectors: [EthereumWalletConnectors],
        walletConnectPreferredChains: ["eip155:31611"],
        networkValidationMode: "never",
        overrides: {
          evmNetworks: (networks) => mergeNetworks([DYNAMIC_MEZO_NETWORK], networks),
        },
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
