/**
 * Contract tests for FlowVault.
 *
 * The contracts are compiled with solc and executed in an in-process EVM
 * (@ethereumjs/vm). No Docker, Foundry or hosted node is needed.
 *
 *   cd contracts
 *   npm install
 *   npm test
 */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const solc = require("solc");
const { VM } = require("@ethereumjs/vm");
const { Block } = require("@ethereumjs/block");
const { Address, hexToBytes, bytesToHex } = require("@ethereumjs/util");
const viem = require("viem");

const usd = (n) => viem.parseUnits(String(n), 18);
const btc = (n) => viem.parseUnits(String(n), 18);

const ROOT = path.join(__dirname, "..");

function compile() {
  const sources = {
    "FlowVault.sol": fs.readFileSync(path.join(ROOT, "FlowVault.sol"), "utf8"),
    "MockProtocol.sol": fs.readFileSync(path.join(__dirname, "mocks/MockProtocol.sol"), "utf8"),
  };
  const input = {
    language: "Solidity",
    sources: Object.fromEntries(
      Object.entries(sources).map(([name, content]) => [name, { content }]),
    ),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  return {
    vault: out.contracts["FlowVault.sol"].FlowVault,
    musd: out.contracts["MockProtocol.sol"].MockMUSD,
    feed: out.contracts["MockProtocol.sol"].MockPriceFeed,
  };
}

const ARTIFACTS = compile();
const PRICE = usd(60000);
const START = 1_700_000_000n;

const EOA = (n) => Address.fromString(`0x${String(n).padStart(2, "0").repeat(20)}`);

async function setup() {
  const vm = await VM.create();
  let timestamp = START;
  const block = () => Block.fromBlockData({ header: { timestamp } }, { common: vm.common });

  const accounts = { owner: EOA(1), alice: EOA(2), bob: EOA(3), carol: EOA(4) };
  for (const a of Object.values(accounts)) {
    await vm.stateManager.modifyAccountFields(a, { balance: 10n ** 21n });
  }

  async function deploy(artifact, args = [], types = args.map(() => "address")) {
    const encoded =
      args.length === 0 ? "0x" : viem.encodeAbiParameters(types.map((type) => ({ type })), args);
    const res = await vm.evm.runCall({
      caller: accounts.owner,
      data: hexToBytes("0x" + artifact.evm.bytecode.object + encoded.slice(2)),
      gasLimit: 30_000_000n,
      block: block(),
    });
    if (res.execResult.exceptionError)
      throw new Error(`deploy failed: ${res.execResult.exceptionError.error}`);
    return res.createdAddress;
  }

  async function send(who, to, abi, functionName, args = [], value = 0n) {
    const data = viem.encodeFunctionData({ abi, functionName, args });
    const res = await vm.evm.runCall({
      caller: accounts[who],
      to,
      data: hexToBytes(data),
      value,
      gasLimit: 30_000_000n,
      block: block(),
    });
    if (res.execResult.exceptionError)
      throw new Error(
        `${functionName} reverted: ${res.execResult.exceptionError.error} ${
          res.execResult.exceptionError.errorMessage ?? ""
        }`,
      );
    return res;
  }

  async function read(to, abi, functionName, args = []) {
    const res = await send("owner", to, abi, functionName, args);
    return viem.decodeFunctionResult({
      abi,
      functionName,
      data: bytesToHex(res.execResult.returnValue),
    });
  }

  async function reverts(who, to, abi, functionName, args = [], value = 0n) {
    const data = viem.encodeFunctionData({ abi, functionName, args });
    const res = await vm.evm.runCall({
      caller: accounts[who],
      to,
      data: hexToBytes(data),
      value,
      gasLimit: 30_000_000n,
      block: block(),
    });
    return Boolean(res.execResult.exceptionError);
  }

  const musd = await deploy(ARTIFACTS.musd);
  const feed = await deploy(ARTIFACTS.feed, [PRICE.toString()], ["uint256"]);
  const vault = await deploy(ARTIFACTS.vault, [musd.toString(), feed.toString()]);

  for (const [key, a] of Object.entries(accounts)) {
    await send("owner", musd, ARTIFACTS.musd.abi, "mint", [a.toString(), usd(100000)]);
    await send(key, musd, ARTIFACTS.musd.abi, "approve", [vault.toString(), 2n ** 256n - 1n]);
  }

  return {
    vm,
    accounts,
    musd,
    feed,
    vault,
    send,
    read,
    reverts,
    advanceYear: () => {
      timestamp += 365n * 24n * 60n * 60n;
    },
    balanceOf: async (a) => (await vm.stateManager.getAccount(a)).balance,
  };
}

const readVault = (t, fn, args = []) => t.read(t.vault, ARTIFACTS.vault.abi, fn, args);
const writeVault = (t, who, fn, args = [], value = 0n) =>
  t.send(who, t.vault, ARTIFACTS.vault.abi, fn, args, value);
const vaultReverts = (t, who, fn, args = [], value = 0n) =>
  t.reverts(who, t.vault, ARTIFACTS.vault.abi, fn, args, value);

const first = (v) => (Array.isArray(v) ? v[0] : v);

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test("counts money out on loan in share value, so a new lender is not diluted", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(1000)]);
  await writeVault(t, "bob", "openLoan", [usd(400), 200n], btc(0.1));

  assert.equal(await readVault(t, "cash"), usd(600));
  assert.equal(await readVault(t, "totalLent"), usd(400));
  assert.equal(await readVault(t, "totalAssets"), usd(1000));

  await writeVault(t, "carol", "lend", [usd(500)]);

  assert.equal(await readVault(t, "shares", [t.accounts.carol.toString()]), usd(500));
  assert.equal(await readVault(t, "totalShares"), usd(1500));
  assert.equal(await readVault(t, "poolOf", [t.accounts.alice.toString()]), usd(1000));
  assert.equal(await readVault(t, "poolOf", [t.accounts.carol.toString()]), usd(500));
  assert.equal(await readVault(t, "totalAssets"), usd(1500));
  assert.equal(await readVault(t, "cash"), usd(1100));
});

test("charges one percent a year and gives the fee to lenders", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(1000)]);
  await writeVault(t, "bob", "openLoan", [usd(400), 200n], btc(0.1));
  await t.advanceYear();

  const owed = await readVault(t, "owedOf", [t.accounts.bob.toString()]);
  assert.ok(owed >= usd(404) && owed < usd(404.01), `owed was ${owed}`);

  await writeVault(t, "bob", "repay", [owed]);

  assert.equal(await readVault(t, "totalLent"), 0n);
  const assets = await readVault(t, "totalAssets");
  assert.ok(assets >= usd(1004) && assets < usd(1004.01), `assets were ${assets}`);
  assert.equal(await readVault(t, "poolOf", [t.accounts.alice.toString()]), assets);
});

test("will not pay out cash that is out on loan", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(1000)]);
  await writeVault(t, "bob", "openLoan", [usd(900), 150n], btc(1));

  assert.equal(await readVault(t, "cash"), usd(100));
  assert.equal(await vaultReverts(t, "alice", "unlend", [usd(1000)]), true);

  await writeVault(t, "alice", "unlend", [usd(100)]);
  assert.equal(await readVault(t, "cash"), 0n);
  assert.equal(await readVault(t, "totalLent"), usd(900));
});

test("keeps 150 percent backing when Bitcoin is taken out", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(1000)]);
  await writeVault(t, "bob", "openLoan", [usd(400), 200n], btc(0.1));

  assert.equal(await vaultReverts(t, "bob", "takeBacking", [btc(0.095)]), true);
  await writeVault(t, "bob", "takeBacking", [btc(0.089)]);

  const loan = await readVault(t, "loans", [t.accounts.bob.toString()]);
  assert.equal(loan[0], btc(0.011));
});

test("lets anyone close a loan below 110 percent", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(1000)]);
  await writeVault(t, "bob", "openLoan", [usd(400), 200n], btc(0.1));

  await t.send("owner", t.feed, ARTIFACTS.feed.abi, "setPrice", [usd(5000)]);
  assert.equal(await vaultReverts(t, "carol", "closeLoan", [t.accounts.bob.toString()]), true);

  await t.send("owner", t.feed, ARTIFACTS.feed.abi, "setPrice", [usd(4000)]);
  const before = await t.balanceOf(t.accounts.carol);
  await writeVault(t, "carol", "closeLoan", [t.accounts.bob.toString()]);
  const after = await t.balanceOf(t.accounts.carol);

  assert.equal(after - before, btc(0.1), "closer did not receive the Bitcoin");

  const loan = await readVault(t, "loans", [t.accounts.bob.toString()]);
  assert.equal(loan[0], 0n);
  assert.equal(loan[1], 0n);
  assert.equal(loan[2], 0n);
  assert.equal(await readVault(t, "totalLent"), 0n);
  assert.equal(await readVault(t, "cash"), usd(1000));
  assert.equal(await readVault(t, "poolOf", [t.accounts.alice.toString()]), usd(1000));
});

test("uses the price feed for every price-dependent action", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(1000)]);
  await writeVault(t, "bob", "openLoan", [usd(400), 200n], btc(0.1));

  await t.send("owner", t.feed, ARTIFACTS.feed.abi, "setStale", [true]);
  assert.equal(await vaultReverts(t, "owner", "btcPrice"), true);
  assert.equal(await vaultReverts(t, "bob", "openLoan", [usd(1), 250n], btc(0.01)), true);
  assert.equal(await vaultReverts(t, "bob", "takeBacking", [btc(0.001)]), true);

  // Repaying and lending do not need a price, so they still work.
  await writeVault(t, "bob", "repay", [usd(10)]);
  await writeVault(t, "alice", "lend", [usd(10)]);

  await t.send("owner", t.feed, ARTIFACTS.feed.abi, "setStale", [false]);
  assert.equal(await readVault(t, "btcPrice"), PRICE);
});

test("checks the combined safety level when a borrower adds a loan", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(1000)]);
  await writeVault(t, "bob", "openLoan", [usd(100), 250n], btc(0.01));
  await writeVault(t, "bob", "openLoan", [usd(100), 250n], btc(0.001));

  assert.equal(await vaultReverts(t, "bob", "openLoan", [usd(100), 250n], btc(0.001)), true);
  assert.equal(await readVault(t, "totalLent"), usd(200));
});

test("returns all cash after the loan is repaid", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(1000)]);
  await writeVault(t, "bob", "openLoan", [usd(400), 200n], btc(0.1));
  await writeVault(t, "bob", "repay", [usd(400)]);

  const before = await readVault(t, "cash");
  await writeVault(t, "alice", "unlend", [usd(1000)]);

  assert.equal(await readVault(t, "totalShares"), 0n);
  assert.equal(await readVault(t, "shares", [t.accounts.alice.toString()]), 0n);
  assert.ok((await readVault(t, "cash")) < before);
  assert.ok((await readVault(t, "totalAssets")) < usd(0.01));
});

test("will not lend more MUSD than it holds", async () => {
  const t = await setup();
  await writeVault(t, "alice", "lend", [usd(100)]);
  assert.equal(await vaultReverts(t, "bob", "openLoan", [usd(101), 250n], btc(1)), true);
});

test("has no owner price setter", async () => {
  const names = ARTIFACTS.vault.abi.filter((e) => e.type === "function").map((e) => e.name);
  assert.equal(names.includes("setPrice"), false);
  assert.equal(names.includes("owner"), false);
  assert.equal(names.includes("priceFeed"), true);
});

(async () => {
  let failed = 0;
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ok  ${name}`);
    } catch (e) {
      failed += 1;
      console.log(`  FAIL  ${name}`);
      console.log(String(e.stack ?? e).split("\n").slice(0, 6).join("\n"));
    }
  }
  console.log(`\n${tests.length - failed}/${tests.length} tests passed`);
  process.exit(failed ? 1 : 0);
})();
