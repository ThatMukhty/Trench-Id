// Vercel Serverless Function: POST /api/voucher
// Pins the card image + metadata to IPFS (Pinata) and returns an EIP-712 signed voucher.
// Env vars (Vercel project settings): SIGNER_PRIVATE_KEY, PINATA_JWT, CHAIN_ID, CONTRACT_ADDRESS, MINT_PRICE_WEI

import { Wallet, getAddress, hexlify, randomBytes } from "ethers";

const TYPES = {
  Voucher: [
    { name: "minter", type: "address" },
    { name: "uri", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

const clean = (v, max = 60) => String(v ?? "").replace(/[<>]/g, "").slice(0, max);

// Plain Node response helper: works even if Express-style helpers are missing.
function send(res, code, body) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

// Reads the JSON body whether or not Vercel already parsed it.
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function pinata(path, init) {
  const r = await fetch(`https://api.pinata.cloud/pinning/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}`, ...(init.headers || {}) }
  });
  if (!r.ok) throw new Error(`IPFS pin failed (${r.status})`);
  return (await r.json()).IpfsHash;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });

  try {
    const { address, image, attrs = {} } = await readBody(req);

    let minter;
    try { minter = getAddress(address); }
    catch { return send(res, 400, { error: "Invalid wallet address" }); }

    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(image || "");
    if (!m) return send(res, 400, { error: "Invalid image" });
    const png = Buffer.from(m[1], "base64");
    if (png.length > 3_000_000) return send(res, 413, { error: "Image too large" });

    // 1) pin image
    const form = new FormData();
    form.append("file", new Blob([png], { type: "image/png" }), "trench-id.png");
    const imgCid = await pinata("pinFileToIPFS", { method: "POST", body: form });

    // 2) pin metadata
    const metadata = {
      name: `Trench ID — @${clean(attrs.handle, 20)}`,
      description: clean(attrs.tagline, 80) || "Trench identity card.",
      image: `ipfs://${imgCid}`,
      attributes: [
        { trait_type: "Rank", value: clean(attrs.rank) },
        { trait_type: "Foil", value: clean(attrs.foil) },
        { trait_type: "Realized PnL", value: clean(attrs.pnl) },
        { trait_type: "Win Rate", value: clean(attrs.winRate) },
        { trait_type: "Trades", value: clean(attrs.trades) },
        { trait_type: "Rugs Survived", value: clean(attrs.rugs) },
        { trait_type: "Since", value: clean(attrs.since, 4) }
      ]
    };
    const metaCid = await pinata("pinJSONToIPFS", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinataContent: metadata })
    });

    // 3) sign voucher (EIP-712)
    const voucher = {
      minter,
      uri: `ipfs://${metaCid}`,
      nonce: BigInt(hexlify(randomBytes(32))).toString(),
      deadline: Math.floor(Date.now() / 1000) + 3600
    };
    const domain = {
      name: "CardIdentityNFT",
      version: "1",
      chainId: Number(process.env.CHAIN_ID),
      verifyingContract: process.env.CONTRACT_ADDRESS
    };
    const signature = await new Wallet(process.env.SIGNER_PRIVATE_KEY).signTypedData(domain, TYPES, voucher);

    return send(res, 200, { voucher, signature, price: process.env.MINT_PRICE_WEI || "0" });
  } catch (e) {
    return send(res, 500, { error: e.message || "Server error" });
  }
}