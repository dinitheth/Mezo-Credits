import "@rainbow-me/rainbowkit/styles.css";

import { useEffect, type ReactNode } from "react";
import {
  ConnectButton,
  connectorsForWallets,
  RainbowKitProvider,
  type Wallet,
  type WalletList,
} from "@rainbow-me/rainbowkit";
import {
  createConfig,
  http,
  injected,
  WagmiProvider,
  useAccount,
  useDisconnect,
  useSwitchChain,
  useWalletClient,
} from "wagmi";
import { defineChain, type Address, type EIP1193Provider, type Hex } from "viem";

import { MEZO, setState, short, switchWalletToMezo } from "@/lib/mezo";
import { setWalletAdapter } from "@/lib/wallet-adapter";
import { Btn } from "./ui-bits";

const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
  testnet: true,
});

const mezoMainnet = defineChain({
  id: 31612,
  name: "Mezo",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.mezo.org"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.mezo.org" } },
});

type InjectedProvider = EIP1193Provider & {
  isBackpack?: true;
  isMetaMask?: true;
  providers?: InjectedProvider[];
};

type InjectedWindow = {
  ethereum?: InjectedProvider;
  backpack?: { ethereum?: InjectedProvider };
};

function walletIcon(letter: string, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="20" fill="${color}"/><text x="20" y="27" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="white">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function injectedWalletEntry(
  id: string,
  name: string,
  letter: string,
  color: string,
  target?: NonNullable<Parameters<typeof injected>[0]>["target"],
): () => Wallet {
  return () => ({
    id,
    name,
    iconUrl: walletIcon(letter, color),
    iconBackground: color,
    createConnector: () => injected(target ? { target } : {}),
  });
}

const mezoWallets: WalletList = [
  {
    groupName: "Browser wallets",
    wallets: [
      injectedWalletEntry("metamask", "MetaMask", "M", "#e27625", {
        id: "metamask",
        name: "MetaMask",
        provider: (targetWindow) => {
          const ethereum = (targetWindow as unknown as InjectedWindow).ethereum;
          return ethereum?.providers?.find((provider) => provider.isMetaMask) ??
            (ethereum?.isMetaMask ? ethereum : undefined);
        },
      }),
      injectedWalletEntry("backpack", "Backpack", "B", "#e13e3e", {
        id: "backpack",
        name: "Backpack",
        provider: (targetWindow) => {
          const walletWindow = targetWindow as unknown as InjectedWindow;
          const backpack = walletWindow.backpack?.ethereum;
          const ethereum = walletWindow.ethereum;
          return backpack ?? ethereum?.providers?.find((provider) => provider.isBackpack) ??
            (ethereum?.isBackpack ? ethereum : undefined);
        },
      }),
      injectedWalletEntry("other-injected", "Other browser wallet", "W", "#315c48"),
    ],
  },
];

const wagmiConfig = createConfig({
  chains: [mezoTestnet, mezoMainnet],
  // Only our injected MetaMask, Backpack, and generic browser connectors are listed.
  // None of these wallet entries creates a WalletConnect or Coinbase connector.
  connectors: connectorsForWallets(mezoWallets, {
    projectId: "unused-no-walletconnect-connectors",
    appName: "MezoFlow",
  }),
  transports: {
    [mezoTestnet.id]: http(),
    [mezoMainnet.id]: http(),
  },
  ssr: true,
});

/** viem expects integer fields in typed data to be bigint values. */
function normalizeTypedData(typed: unknown): unknown {
  const value = typed as {
    types: Record<string, { name: string; type: string }[]>;
    primaryType: string;
    domain: Record<string, unknown>;
    message: Record<string, unknown>;
  };
  const types = { ...value.types };
  delete types["EIP712Domain"];
  const message = { ...value.message };
  for (const field of types[value.primaryType] ?? []) {
    const item = message[field.name];
    if (/^u?int\d*$/.test(field.type) && item !== undefined && typeof item !== "bigint") {
      message[field.name] = BigInt(item as string | number);
    }
  }
  const domain = { ...value.domain };
  const chainId = domain["chainId"];
  if (typeof chainId === "string") domain["chainId"] = BigInt(chainId);
  return { ...value, domain, types, message };
}

/** Keep the existing payment and lending code connected to the selected wallet. */
function WalletSync() {
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { disconnectAsync } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();

  useEffect(() => {
    if (!isConnected || !address || !chainId || !walletClient) {
      setWalletAdapter(null);
      if (!isConnected) setState({ account: null, chainId: null });
      return;
    }

    setState({ account: address, chainId });
    setWalletAdapter({
      request: (args) => walletClient.request(args as never),
      sendTransaction: async (tx) =>
        walletClient.sendTransaction({
          account: tx.from as Address,
          to: tx.to as Address,
          data: tx.data as Hex,
          ...(tx.value === undefined ? {} : { value: BigInt(tx.value) }),
        }),
      signTypedData: async (_account, typed) =>
        walletClient.signTypedData(normalizeTypedData(typed) as never),
      switchNetwork: async (id) => {
        if (id !== mezoTestnet.id && id !== mezoMainnet.id) {
          throw new Error("That network is not supported here.");
        }
        try {
          await switchChainAsync({ chainId: id });
        } catch (error) {
          if (id !== MEZO.chainId) throw error;
          await switchWalletToMezo({ request: (args) => walletClient.request(args as never) });
        }
      },
      logout: () => disconnectAsync(),
    });

    return () => setWalletAdapter(null);
  }, [address, chainId, disconnectAsync, isConnected, switchChainAsync, walletClient]);

  return null;
}

export function RainbowWalletRoot({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={false}>
      <RainbowKitProvider initialChain={mezoTestnet.id}>
        <WalletSync />
        {children}
      </RainbowKitProvider>
    </WagmiProvider>
  );
}

export function RainbowConnectArea({
  remembered,
  disabled = false,
}: {
  remembered?: string | null;
  disabled?: boolean;
}) {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <Btn disabled={!mounted || disabled} onClick={openConnectModal}>
          {remembered ? `Reconnect ${short(remembered)}` : "Connect wallet"}
        </Btn>
      )}
    </ConnectButton.Custom>
  );
}
