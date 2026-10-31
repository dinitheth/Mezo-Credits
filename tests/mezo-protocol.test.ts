import { describe, expect, it } from "vitest";
import { MEZO_PROTOCOL, mezoProtocolFor } from "@/lib/onchain";

describe("Mezo protocol addresses", () => {
  it("uses Mezo's official test network contracts", () => {
    expect(MEZO_PROTOCOL[31611].priceFeed).toBe("0x86bCF0841622a5dAC14A313a15f96A95421b9366");
    expect(MEZO_PROTOCOL[31611].troveManager).toBe("0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0");
    expect(MEZO_PROTOCOL[31611].borrowerOperations).toBe(
      "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
    );
  });

  it("uses Mezo's official mainnet contracts", () => {
    expect(MEZO_PROTOCOL[31612].priceFeed).toBe("0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88");
    expect(MEZO_PROTOCOL[31612].troveManager).toBe("0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193");
  });

  it("does not pretend other networks have Mezo contracts", () => {
    expect(mezoProtocolFor(31611)).toBe(MEZO_PROTOCOL[31611]);
    expect(mezoProtocolFor(31612)).toBe(MEZO_PROTOCOL[31612]);
    expect(mezoProtocolFor(1)).toBeNull();
    expect(mezoProtocolFor(null)).toBeNull();
  });
});
