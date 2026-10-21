import { Wallet, getAddress, hexlify, randomBytes } from "ethers";

const TYPES = {
  Voucher: [
    { name: "minter", type: "address" },
    { name: "uri", type: "string" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" }
  ]
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
}

export async function POST(req) {
  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      // fallback if body is empty
    }

    const { minter } = body;

    if (!minter) {
      return new Response(JSON.stringify({ error: "Missing minter address" }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const privateKey = process.env.SIGNER_PRIVATE_KEY;
    const chainId = process.env.CHAIN_ID || 1;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    if (!privateKey || !contractAddress) {
      return new Response(
        JSON.stringify({ error: "Contract or Signer environment variables are not configured on Vercel yet." }),
        { status: 500, headers: corsHeaders }
      );
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
    
    // In production, you can pin the incoming card image or attributes JSON to IPFS here.
    // For now, it passes a placeholder URI or data reference.
    const uri = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

    const value = {
      minter: getAddress(minter),
      uri,
      nonce,
      deadline
    };

    const signature = await wallet.signTypedData(domain, TYPES, value);

    return new Response(
      JSON.stringify({
        voucher: {
          minter: value.minter,
          uri,
          nonce,
          deadline
        },
        signature: signature,
        price: process.env.MINT_PRICE_WEI || "0"
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message || "Server execution error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}