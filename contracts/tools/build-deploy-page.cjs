// Builds public/deploy.html: a one-page, wallet-signed deploy helper for the
// two MezoFlow contracts. No keys, no backend: the browser wallet sends the
// same creation transactions Remix would send.
const fs = require("fs");
const path = require("path");
const solc = require("solc");

const ROOT = path.resolve(__dirname, "..", "..");
const MUSD_TESTNET = "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503";
const PRICE_FEED_TESTNET = "0x86bCF0841622a5dAC14A313a15f96A95421b9366";

function compile(file) {
  const source = fs.readFileSync(path.join(ROOT, "contracts", file), "utf8");
  const input = {
    language: "Solidity",
    sources: { [file]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
    },
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (output.errors || []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.formattedMessage).join("\n"));
  const name = file.replace(/\.sol$/, "");
  const c = output.contracts[file][name];
  return { abi: c.abi, bytecode: "0x" + c.evm.bytecode.object };
}

const pad = (address) => address.toLowerCase().replace(/^0x/, "").padStart(64, "0");

const router = compile("InvoiceRouter.sol");
const vault = compile("FlowVault.sol");

const deployments = {
  router: { bytecode: router.bytecode + pad(MUSD_TESTNET), abi: router.abi },
  vault: { bytecode: vault.bytecode + pad(MUSD_TESTNET) + pad(PRICE_FEED_TESTNET), abi: vault.abi },
};

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Put MezoFlow contracts on Mezo testnet</title>
    <style>
      :root {
        --ink: #1d2b24; --muted: #5b6b62; --cream: #fbf6e9; --card: #fffdf7;
        --green: #1f7a4d; --gold: #c8892f; --line: #e4dcc8; --bad: #a33232;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 32px 16px 64px; background: var(--cream); color: var(--ink);
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        line-height: 1.5;
      }
      main { max-width: 820px; margin: 0 auto; }
      h1 { font-size: 30px; line-height: 1.15; margin: 0 0 8px; letter-spacing: -0.02em; }
      p { margin: 0 0 12px; color: var(--muted); }
      .card { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 20px; margin: 16px 0; }
      .card h2 { margin: 0 0 4px; font-size: 19px; }
      .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 12px; }
      button {
        font: inherit; font-weight: 700; padding: 10px 16px; border-radius: 9px; cursor: pointer;
        border: 1px solid var(--green); background: var(--green); color: #fff;
      }
      button.secondary { background: transparent; color: var(--green); }
      button:disabled { opacity: 0.45; cursor: not-allowed; }
      code, .mono { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 13px; word-break: break-all; }
      .pill { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #e4f2e8; color: var(--green); font-size: 13px; font-weight: 700; }
      .bad { color: var(--bad); }
      .ok { color: var(--green); }
      .note { font-size: 13px; }
      ol { margin: 8px 0 0; padding-left: 20px; color: var(--muted); }
      li { margin: 4px 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>Put MezoFlow on Mezo testnet</h1>
      <p>This page sends two contract creation transactions from your own wallet. It cannot move your money, and it holds no keys. Testnet only.</p>
      <p class="pill" id="net">Checking wallet…</p>

      <div class="card">
        <h2>1. Payment contract</h2>
        <p class="note">Moves MUSD for paid bills and writes a public receipt.</p>
        <div class="row">
          <button id="routerBtn" disabled>Deploy payment contract</button>
          <span id="routerMsg" class="note"></span>
        </div>
        <p id="routerOut" class="mono" hidden></p>
      </div>

      <div class="card">
        <h2>2. Lending pool</h2>
        <p class="note">Lets people lend MUSD and borrow against Bitcoin. It reads Bitcoin's price from Mezo, and it has no owner.</p>
        <div class="row">
          <button id="vaultBtn" disabled>Deploy lending pool</button>
          <span id="vaultMsg" class="note"></span>
        </div>
        <p id="vaultOut" class="mono" hidden></p>
      </div>

      <div class="card">
        <h2>What to do with the two addresses</h2>
        <ol>
          <li>Copy them into the hosting settings as <code>VITE_ROUTER_ADDRESS_TESTNET</code> and <code>VITE_VAULT_ADDRESS_TESTNET</code>.</li>
          <li>Redeploy the app.</li>
          <li>Open the Grow page and lend a small amount of MUSD to fill the pool.</li>
          <li>Make a small bill and pay it, then borrow a small amount. Both should show a receipt.</li>
        </ol>
      </div>
    </main>

    <script>
      const DEPLOYMENTS = ${JSON.stringify(deployments)};
      const CHAIN_ID = "0x7b7b";
      const CHAIN = {
        chainId: CHAIN_ID,
        chainName: "Mezo Testnet",
        nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
        rpcUrls: ["https://rpc.test.mezo.org"],
        blockExplorerUrls: ["https://explorer.test.mezo.org"],
      };

      const netEl = document.getElementById("net");
      let account = null;

      function setMsg(which, text, bad) {
        const el = document.getElementById(which + "Msg");
        el.textContent = text;
        el.className = bad ? "note bad" : "note ok";
      }

      async function wallet() {
        if (!window.ethereum) throw new Error("No browser wallet found. Install one first.");
        return window.ethereum;
      }

      async function connect() {
        const eth = await wallet();
        const accounts = await eth.request({ method: "eth_requestAccounts" });
        account = accounts[0];
        let chain = await eth.request({ method: "eth_chainId" });
        if (chain !== CHAIN_ID) {
          try {
            await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID }] });
          } catch {
            await eth.request({ method: "wallet_addEthereumChain", params: [CHAIN] });
          }
          chain = await eth.request({ method: "eth_chainId" });
        }
        const onMezo = chain === CHAIN_ID;
        netEl.textContent = onMezo ? "Mezo testnet · " + account.slice(0, 6) + "…" + account.slice(-4) : "Wrong network";
        netEl.className = onMezo ? "pill" : "pill bad";
        document.getElementById("routerBtn").disabled = !onMezo;
        document.getElementById("vaultBtn").disabled = !onMezo;
      }

      async function deploy(kind) {
        const which = kind === "router" ? "router" : "vault";
        const btn = document.getElementById(which + "Btn");
        btn.disabled = true;
        setMsg(which, "Waiting for your wallet…");
        try {
          const eth = await wallet();
          const hash = await eth.request({
            method: "eth_sendTransaction",
            params: [{ from: account, data: DEPLOYMENTS[kind].bytecode }],
          });
          setMsg(which, "Sent. Waiting for the receipt…");
          let receipt = null;
          for (let i = 0; i < 120 && !receipt; i++) {
            receipt = await eth.request({ method: "eth_getTransactionReceipt", params: [hash] });
            if (!receipt) await new Promise((r) => setTimeout(r, 2000));
          }
          if (!receipt) throw new Error("No receipt yet. Check the explorer for " + hash);
          if (receipt.status !== "0x1") throw new Error("The transaction failed. Nothing was deployed.");
          const address = receipt.contractAddress;
          const out = document.getElementById(which + "Out");
          out.hidden = false;
          out.innerHTML =
            "<b>" + address + "</b><br/>" +
            '<a href="https://explorer.test.mezo.org/address/' + address + '" target="_blank" rel="noreferrer">Open in explorer</a>';
          setMsg(which, "Done. Copy the address above.");
        } catch (e) {
          setMsg(which, (e && e.message) || "Something went wrong.", true);
        } finally {
          btn.disabled = false;
        }
      }

      document.getElementById("routerBtn").addEventListener("click", () => deploy("router"));
      document.getElementById("vaultBtn").addEventListener("click", () => deploy("vault"));
      connect().catch((e) => {
        netEl.textContent = (e && e.message) || "Wallet not available";
        netEl.className = "pill bad";
      });
    </script>
  </body>
</html>
`;

fs.writeFileSync(path.join(ROOT, "public", "deploy.html"), html);
console.log("wrote public/deploy.html");
console.log("router bytecode:", router.bytecode.length, "chars");
console.log("vault bytecode:", vault.bytecode.length, "chars");
