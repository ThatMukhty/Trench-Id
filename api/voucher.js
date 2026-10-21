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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { minter } = req.body || {};

    if (!minter) {
      return res.status(400).json({ error: "Missing minter address" });
    }

    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    const chainId = process.env.CHAIN_ID || 1;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    // If variables aren't set yet, return a graceful warning instead of a 500 crash
    if (!privateKey || !contractAddress) {
      return res.status(500).json({ 
        error: "Contract or Signer environment variables are not configured on Vercel yet." 
      });
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
    const uri = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    const value = {
      minter: getAddress(minter),
      uri,
      nonce,
      deadline
    };

    const signature = await wallet.signTypedData(domain, TYPES, value);
    
    return res.status(200).json({
      voucher: { 
        minter: value.minter, 
        uri, 
        nonce, 
        deadline 
      },
      signature: signature,
      price: process.env.MINT_PRICE_WEI || "0"
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || "Server execution error" });
  }
}