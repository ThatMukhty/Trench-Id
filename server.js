import { Wallet, getAddress, hexlify, randomBytes } from "ethers";

const TYPES = {
  Voucher: [
    { name: "minter", type: "address" },
    { name: "uri", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(204).setHeader("Access-Control-Allow-Origin", "*").end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { minter, uri } = req.body;

    if (!minter || !uri) {
      return res.status(400).json({ error: "Missing minter or uri" });
    }

    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    const chainId = process.env.CHAIN_ID || 1;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      return res.status(500).json({ error: "Server environment misconfigured" });
    }

    const wallet = new Wallet(privateKey);
    const domain = {
      name: "CardIdentityNFT",
      version: "1",
      chainId: Number(chainId),
      verifyingContract: getAddress(contractAddress)
    };

    const nonce = hexlify(randomBytes(32));
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const value = {
      minter: getAddress(minter),
      uri,
      nonce,
      deadline
    };

    const signature = await wallet.signTypedData(domain, TYPES, value);

    return res.status(200).json({
      voucher: { minter: value.minter, uri, nonce, deadline, signature },
      price: process.env.MINT_PRICE_WEI || "0"
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server error" });
  }
}