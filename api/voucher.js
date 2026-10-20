import { Wallet, getAddress, hexlify, randomBytes } from "ethers";

const TYPES = {
  Voucher: [
    { name: "minter", type: "address" },
    { name: "uri", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

export default async function handler(req) {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const body = await req.json();
    const { address: minter, image, attrs } = body;

    if (!minter) {
      return new Response(JSON.stringify({ error: "Missing minter address" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    const chainId = process.env.CHAIN_ID || 1;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      return new Response(JSON.stringify({ error: "Server environment variables (SIGNER_PRIVATE_KEY or CONTRACT_ADDRESS) are missing." }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // In a full production setup, you can pin `image` or `attrs` to IPFS here.
    // For this voucher workflow, we construct the URI payload.
    const uri = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"; // Placeholder or generated metadata URI

    const wallet = new Wallet(privateKey);
    const domain = {
      name: "CardIdentityNFT",
      version: "1",
      chainId: Number(chainId),
      verifyingContract: getAddress(contractAddress)
    };

    const nonce = hexlify(randomBytes(32));
    const deadline = Math.floor(Date.now() / 1000) + 3600; // valid for 1 hour

    const value = {
      minter: getAddress(minter),
      uri,
      nonce,
      deadline
    };

    const signature = await wallet.signTypedData(domain, TYPES, value);

    return new Response(
      JSON.stringify({
        voucher: { minter: value.minter, uri, nonce, deadline, signature },
        price: process.env.MINT_PRICE_WEI || "0"
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || "Server error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}