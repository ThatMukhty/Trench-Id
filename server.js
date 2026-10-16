// server.js
const express = require('express');
const { ethers } = require('ethers');
const app = express();

app.use(express.json());

// Set your backend wallet private key in Vercel Environment Variables
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || "0xYOUR_SIGNER_PRIVATE_KEY_HERE"; 
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0xYOUR_DEPLOYED_CONTRACT_ADDRESS";
const CHAIN_ID = 1; // 1 for Ethereum Mainnet, 11155111 for Sepolia

app.post('/api/get-mint-signature', async (req, res) => {
    try {
        const { to, handle, archetype, tokenURI, nonce } = req.body;

        if (!to || !handle || !archetype) {
            return res.status(400).json({ error: "Missing required card fields." });
        }

        const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);

        // EIP-712 Domain Separator
        const domain = {
            name: "TrenchIdentity",
            version: "1",
            chainId: CHAIN_ID,
            verifyingContract: CONTRACT_ADDRESS
        };

        // EIP-712 Struct Types
        const types = {
            NFTCard: [
                { name: "to", type: "address" },
                { name: "handle", type: "string" },
                { name: "archetype", type: "string" },
                { name: "tokenURI", type: "string" },
                { name: "nonce", type: "uint256" }
            ]
        };

        const value = { to, handle, archetype, tokenURI, nonce };

        // Generate cryptographic signature
        const signature = await wallet.signTypedData(domain, types, value);

        res.json({ signature, nonce });
    } catch (err) {
        console.error("Signature Error:", err);
        res.status(500).json({ error: "Failed to generate EIP-712 signature" });
    }
});

// Export app for Vercel Serverless Function engine
module.exports = app;