import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreditForm } from "@/components/CreditForm";
import { OnchainPanel } from "@/components/OnchainPanel";
import { setState } from "@/lib/mezo";
import { mezoTokenAddressFor } from "@/lib/onchain";

const ADDR = "0x5555555555555555555555555555555555555555";
const word = (n: bigint) => `0x${n.toString(16).padStart(64, "0")}`;

beforeEach(() => {
  localStorage.clear();
  delete (window as unknown as { ethereum?: unknown }).ethereum;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setState({
    account: null,
    chainId: null,
    btcPrice: 0,
    priceLive: false,
    invoices: [],
    activity: [],
    lastWallet: null,
  });
});

describe("wallet balances", () => {
  it("shows real MUSD and never invents a MEZO row without a token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: word(123_450_000_000_000_000_000n) }),
    });
    vi.stubGlobal("fetch", fetchMock);
    setState({ account: ADDR, chainId: 31611 });

    render(<OnchainPanel />);

    expect(await screen.findByText("123.45")).toBeInTheDocument();
    expect(screen.getByText("MUSD")).toBeInTheDocument();
    if (!mezoTokenAddressFor(31611)) {
      expect(screen.queryByText("MEZO")).not.toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    }
  });

  it("asks for a wallet before showing balances", () => {
    setState({ account: null, chainId: null });
    render(<OnchainPanel />);

    expect(
      screen.getByText("Connect your wallet above to see your money here."),
    ).toBeInTheDocument();
    expect(screen.queryByText("MUSD")).not.toBeInTheDocument();
  });

  it("warns when the wallet is on another network", async () => {
    setState({ account: ADDR, chainId: 1 });
    render(<OnchainPanel />);

    expect(
      await screen.findByText("You are on another network. Switch to Mezo to pay."),
    ).toBeInTheDocument();
    expect(screen.queryByText("MEZO")).not.toBeInTheDocument();
  });
});

describe("borrow planner", () => {
  it("turns a Bitcoin amount into money at the chosen safety level", () => {
    setState({ btcPrice: 68_000, priceLive: true });
    render(<CreditForm poolSize={10_000} walletMusd={500} />);

    expect(screen.queryByRole("button", { name: /^Borrow/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("e.g. 0.05"), { target: { value: "0.1" } });

    expect(screen.getAllByText(/3,400/).length).toBeGreaterThan(0);
    expect(screen.getByText(/In your wallet now/)).toHaveTextContent("500 MUSD");
  });

  it("hands the borrow request up with the amount and safety level", () => {
    setState({ btcPrice: 68_000, priceLive: true });
    const onBorrow = vi.fn();
    const { rerender } = render(<CreditForm />);
    fireEvent.change(screen.getByPlaceholderText("e.g. 0.05"), { target: { value: "0.1" } });

    rerender(<CreditForm onBorrow={onBorrow} />);
    fireEvent.click(screen.getByRole("button", { name: /^Borrow/ }));

    expect(onBorrow).toHaveBeenCalledTimes(1);
    const info = onBorrow.mock.calls[0]?.[0] as { btc: number; amount: number; tier: number };
    expect(info.btc).toBeCloseTo(0.1);
    expect(info.amount).toBeCloseTo(3_400);
    expect(info.tier).toBe(200);
  });

  it("warns at the 150% safety level, not only below it", () => {
    setState({ btcPrice: 68_000, priceLive: true });
    render(<CreditForm onBorrow={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText("e.g. 0.05"), { target: { value: "0.1" } });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Active/ }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Careful: at 150% a small price drop can close your loan.",
    );

    fireEvent.click(screen.getByRole("radio", { name: /Conservative/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("limits the amount to what the pool can lend", () => {
    setState({ btcPrice: 68_000, priceLive: true });
    render(<CreditForm poolSize={1_000} />);
    fireEvent.change(screen.getByPlaceholderText("e.g. 0.05"), { target: { value: "1" } });

    expect(screen.getByText(/pool holds 1,000 MUSD/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 0.05")).toHaveValue("0.029411");
  });
});
