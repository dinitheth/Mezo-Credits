// Deploys the exact bytecode embedded in public/deploy.html into an in-process
// EVM, so a bad constructor argument or stale compile is caught before anyone
// spends testnet BTC on gas.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const { VM } = require("@ethereumjs/vm");
const { Block } = require("@ethereumjs/block");
const { Address, hexToBytes } = require("@ethereumjs/util");
const viem = require("viem");

const ROOT = path.join(__dirname, "..", "..");
const html = fs.readFileSync(path.join(ROOT, "public", "deploy.html"), "utf8");
const match = html.match(/const DEPLOYMENTS = (\{[\s\S]*?\});\n/);
assert.ok(match, "deploy page is missing its DEPLOYMENTS block");
const deployments = JSON.parse(match[1]);

const MUSD = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const FEED = "0x86bCF0841622a5dAC14A313a15f96A95421b9366";

async function main() {
  const vm = await VM.create();
  const caller = Address.fromString("0x" + "11".repeat(20));
  await vm.stateManager.modifyAccountFields(caller, { balance: 10n ** 21n });
  const block = () => Block.fromBlockData({ header: { timestamp: 1_700_000_000n } }, { common: vm.common });

  async function deploy(name) {
    const data = deployments[name].bytecode;
    assert.match(data, /^0x[0-9a-f]+$/i, `${name} bytecode is not hex`);
    const res = await vm.evm.runCall({
      caller,
      data: hexToBytes(data),
      gasLimit: 30_000_000n,
      block: block(),
    });
    if (res.execResult.exceptionError)
      throw new Error(`${name} deploy failed: ${res.execResult.exceptionError.error}`);
    assert.ok(res.createdAddress, `${name} produced no address`);
    const code = await vm.stateManager.getContractCode(res.createdAddress);
    assert.ok(code.length > 0, `${name} deployed no code`);

    async function call(abi, functionName) {
      const data = viem.encodeFunctionData({ abi, functionName });
      const out = await vm.evm.runCall({
        caller,
        to: res.createdAddress,
        data: hexToBytes(data),
        gasLimit: 5_000_000n,
        block: block(),
      });
      assert.ok(!out.execResult.exceptionError, `${name}.${functionName} reverted`);
      return viem.decodeFunctionResult({
        abi,
        functionName,
        data: `0x${Buffer.from(out.execResult.returnValue).toString("hex")}`,
      });
    }

    return { address: res.createdAddress, call, abi: deployments[name].abi, name };
  }

  const router = await deploy("router");
  assert.equal(String(await router.call(router.abi, "musd")).toLowerCase(), MUSD.toLowerCase());

  const vault = await deploy("vault");
  assert.equal(String(await vault.call(vault.abi, "musd")).toLowerCase(), MUSD.toLowerCase());
  assert.equal(String(await vault.call(vault.abi, "priceFeed")).toLowerCase(), FEED.toLowerCase());
  assert.equal(await vault.call(vault.abi, "totalLent"), 0n);
  assert.equal(await vault.call(vault.abi, "totalShares"), 0n);

  console.log("deploy page data is valid");
  console.log("  payment contract at", router.address.toString());
  console.log("  lending pool at   ", vault.address.toString());
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
