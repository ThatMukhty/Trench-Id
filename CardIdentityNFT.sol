// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title CardIdentityNFT
 * @dev ERC721 token that verifies EIP-712 signatures before allowing users to mint their Identity Card.
 */
contract CardIdentityNFT is ERC721, ERC721URIStorage, Ownable, EIP712 {
    using ECDSA for bytes32;

    uint256 private _nextTokenId;
    address public signerAddress; // Backend or admin signer address

    bytes32 private constant MINT_TYPEHASH = keccak256(
        "NFTCard(address to,string handle,string archetype,string tokenURI,uint256 nonce)"
    );

    mapping(uint256 => bool) public usedNonces;

    event CardMinted(address indexed minter, uint256 indexed tokenId, string handle, string archetype);

    constructor(address _signer) 
        ERC721("Trench Identity Card", "TRENCH") 
        EIP712("TrenchIdentity", "1") 
        Ownable(msg.sender) 
    {
        signerAddress = _signer;
    }

    function setSignerAddress(address _signer) external onlyOwner {
        signerAddress = _signer;
    }

    /**
     * @dev Mint an Identity Card NFT using a valid EIP-712 signature.
     */
    function mintCard(
        address to,
        string calldata handle,
        string calldata archetype,
        string calldata uri,
        uint256 nonce,
        bytes calldata signature
    ) external payable {
        require(!usedNonces[nonce], "Nonce already used");
        require(msg.sender == to, "Can only mint to self");

        // Verify EIP-712 Signature
        bytes32 structHash = keccak256(
            abi.encode(
                MINT_TYPEHASH,
                to,
                keccak256(bytes(handle)),
                keccak256(bytes(archetype)),
                keccak256(bytes(uri)),
                nonce
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address recoveredSigner = ECDSA.recover(digest, signature);
        require(recoveredSigner == signerAddress, "Invalid signature");

        // Execute Mint
        usedNonces[nonce] = true;
        uint256 tokenId = ++_nextTokenId;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        emit CardMinted(to, tokenId, handle, archetype);
    }

    // Standard Overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}