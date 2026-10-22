import { describe, expect, it } from "vitest";
import { friendly } from "@/lib/errors";

describe("friendly errors", () => {
  it("explains a closed wallet popup", () => {
    expect(friendly(new Error("User rejected the request."))).toBe(
      "You closed the wallet popup, so nothing happened.",
    );
    expect(friendly(new Error("denied (code: 4001)"))).toBe(
      "You closed the wallet popup, so nothing happened.",
    );
  });

  it("explains missing money", () => {
    expect(friendly(new Error("insufficient funds for gas"))).toBe(
      "There is not enough money in your wallet for this. Top up and try again.",
    );
  });

  it("explains the wrong network", () => {
    expect(friendly(new Error("No chain was provided to the request."))).toBe(
      "Your wallet is on the wrong network. Switch to Mezo and try again.",
    );
  });

  it("turns a contract revert into plain words", () => {
    expect(friendly(new Error("execution reverted: Unsafe()"))).toBe(
      "The pool said no to this one. Check the amount and try again.",
    );
  });

  it("explains a slow network", () => {
    expect(friendly(new Error("Transaction timed out waiting for receipt"))).toBe(
      "The network is slow right now. Check Past payments in a minute.",
    );
  });

  it("explains an unreachable network", () => {
    expect(friendly(new Error("Network read failed (502)."))).toBe(
      "We could not reach the network. Check your connection and try again.",
    );
  });

  it("hides long technical dumps", () => {
    const raw =
      "Request Arguments: from: 0x1234567890abcdef1234567890abcdef12345678 Version: viem@2.37.0 https://rpc.test.mezo.org";
    const clean = friendly(new Error(raw));
    expect(clean).toBe("That did not go through. Nothing moved. Please try again.");
    expect(clean).not.toMatch(/viem|0x|https?:/);
  });

  it("keeps short plain messages as they are", () => {
    expect(friendly(new Error("Connect your wallet first."))).toBe("Connect your wallet first.");
  });

  it("still says something useful for an empty error", () => {
    expect(friendly(null)).toBe("That did not go through. Nothing moved. Please try again.");
    expect(friendly(new Error(""))).toBe(
      "That did not go through. Nothing moved. Please try again.",
    );
  });
});
