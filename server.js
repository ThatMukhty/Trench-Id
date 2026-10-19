// Vercel serverless function: POST /api/voucher
// Pins the card image + metadata to IPFS (Pinata) and returns an EIP-712 signed voucher.
// Required environment variables (set in your Vercel project settings):
//   SIGNER_PRIVATE_KEY  - key of the wallet set as voucherSigner in the contract (use a dedicated wallet!)
//   PINATA_JWT          - Pinata API token
//   CHAIN_ID            - e.g. 1 (mainnet) or 11155111 (Sepolia)
//   CONTRACT_ADDRESS    - deployed CardIdentityNFT address
//   MINT_PRICE_WEI      - must equal the contract's mintPrice (0 for free)

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

async function pinata(path, init) {
  const r = await fetch(`https://api.pinata.cloud/pinning/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.PINATA_JWT}`, ...(init.headers || {}) }
  });
  if (!r.ok) throw new Error(`IPFS pin failed (${r.status})`);
  return (await r.json()).IpfsHash;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { address, image, attrs = {} } = req.body || {};
    const minter = getAddress(address);

    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(image || "");
    if (!m) return res.status(400).json({ error: "Invalid image" });
    const png = Buffer.from(m[1], "base64");
    if (png.length > 3_000_000) return res.status(413).json({ error: "Image too large" });

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
  const signature = await wallet.signTypedData(domain, TYPES, value);
    
    return new Response(JSON.stringify({ voucher, signature, price: process.env.MINT_PRICE_WEI || "0" }), {
      status: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Server error" }), {
      status: 500,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }