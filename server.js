// server.js
const express = require('express');
const { ethers } = require('ethers');
const app = express();

app.use(express.json());
app.use(express.static('.')); // Serves index.html

// PRIVATE KEY of the authorised signer account (Set in .env in production)
const SIGNER_PRIVATE_KEY = "0xYOUR_SIGNER_PRIVATE_KEY_HERE"; 
const CONTRACT_ADDRESS = "0xYOUR_DEPLOYED_CONTRACT_ADDRESS";
const CHAIN_ID = 1; // 1 for Ethereum Mainnet, 11155111 for Sepolia

const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);

app.post('/api/get-mint-signature', async (req, res) => {
    try {
        const { to, handle, archetype, tokenURI, nonce } = req.body;

        // EIP-712 Domain Separator Definition
        const domain = {
            name: "TrenchIdentity",
            version: "1",
            chainId: CHAIN_ID,
            verifyingContract: CONTRACT_ADDRESS
        };

        // EIP-712 Struct Type Definition
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

        // Sign typed EIP-712 data off-chain
        const signature = await wallet.signTypedData(domain, types, value);

        res.json({ signature, nonce });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to generate EIP-712 signature" });
    }
});

app.listen(3000, () => {
    console.log('Trench Identity Server running at http://localhost:3000');
});