import { ethers } from "ethers";

export default async function handler(req, res) {
  // Allow only POST requests to prevent 405 routing conflicts
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { minter, uri } = req.body;

    if (!minter || !uri) {
      return res.status(400).json({ error: "Missing required fields: minter or uri" });
    }

    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    const chainId = process.env.CHAIN_ID || "11155111"; // Default to Sepolia testnet if unset

    if (!privateKey || !contractAddress) {
      return res.status(500).json({ error: "Server configuration error: missing environment variables." });
    }

    const signer = new ethers.Wallet(privateKey);

    // EIP-712 Domain parameters matching constructor: EIP712("CardIdentityNFT", "1")
    const domain = {
      name: "CardIdentityNFT",
      version: "1",
      chainId: Number(chainId),
      verifyingContract: contractAddress,
    };

    // Types definition matching Solidity struct Voucher
    const types = {
      Voucher: [
        { name: "minter", type: "address" },
        { name: "uri", type: "string" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };

    // Generate unique values
    const nonce = Date.now();
    const deadline = Math.floor(Date.now() / 1000) + 60 * 15; // Valid for 15 minutes

    const value = {
      minter,
      uri,
      nonce,
      deadline,
    };

    // Sign the typed data using EIP-712 standard
    const signature = await signer.signTypedData(domain, types, value);

    return res.status(200).json({
      voucher: {
        minter,
        uri,
        nonce,
        deadline,
      },
      signature,
    });
  } catch (err) {
    console.error("Voucher generation error:", err);
    return res.status(500).json({ error: err.message });
  }
}