// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts@5.0.2/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts@5.0.2/token/ERC721/extensions/ERC721URIStorage.sol";
import {EIP712} from "@openzeppelin/contracts@5.0.2/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts@5.0.2/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts@5.0.2/access/Ownable.sol";

/// @title CardIdentityNFT
/// @notice Trench identity cards, lazily minted. The creator signs an EIP-712
///         voucher off-chain ($0 gas). The holder redeems it on-chain and pays
///         only their own mint gas (+ optional mint price).
contract CardIdentityNFT is ERC721URIStorage, EIP712, Ownable {
    struct Voucher {
        address minter;   // wallet allowed to redeem
        string uri;       // ipfs:// metadata URI
        uint256 nonce;    // unique per voucher
        uint256 deadline; // unix seconds
    }

    bytes32 private constant VOUCHER_TYPEHASH =
        keccak256("Voucher(address minter,string uri,uint256 nonce,uint256 deadline)");

    address public voucherSigner;
    uint256 public mintPrice;
    uint256 public maxPerWallet = 1;
    uint256 public totalMinted;

    mapping(uint256 => bool) public nonceUsed;
    mapping(address => uint256) public mintedBy;

    event Redeemed(address indexed minter, uint256 indexed tokenId, uint256 nonce);
    event SignerUpdated(address signer);
    event PriceUpdated(uint256 price);

    error BadSigner();
    error NotMinter();
    error Expired();
    error NonceUsed();
    error WalletLimit();
    error WrongPayment();
    error WithdrawFailed();

    constructor(address signer_, uint256 mintPrice_)
        ERC721("Trench Identity Card", "TRENCHID")
        EIP712("CardIdentityNFT", "1")
        Ownable(msg.sender)
    {
        voucherSigner = signer_;
        mintPrice = mintPrice_;
    }

    function redeem(Voucher calldata v, bytes calldata signature)
        external
        payable
        returns (uint256 tokenId)
    {
        if (v.minter != msg.sender) revert NotMinter();
        if (block.timestamp > v.deadline) revert Expired();
        if (nonceUsed[v.nonce]) revert NonceUsed();
        if (mintedBy[msg.sender] >= maxPerWallet) revert WalletLimit();
        if (msg.value != mintPrice) revert WrongPayment();
        if (ECDSA.recover(hashVoucher(v), signature) != voucherSigner) revert BadSigner();

        nonceUsed[v.nonce] = true;
        mintedBy[msg.sender] += 1;
        tokenId = ++totalMinted;

        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, v.uri);
        emit Redeemed(msg.sender, tokenId, v.nonce);
    }

    function hashVoucher(Voucher calldata v) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(VOUCHER_TYPEHASH, v.minter, keccak256(bytes(v.uri)), v.nonce, v.deadline))
        );
    }

    // ---- owner controls ----
    function setSigner(address s) external onlyOwner { voucherSigner = s; emit SignerUpdated(s); }
    function setMintPrice(uint256 p) external onlyOwner { mintPrice = p; emit PriceUpdated(p); }
    function setMaxPerWallet(uint256 m) external onlyOwner { maxPerWallet = m; }

    function withdraw() external onlyOwner {
        (bool ok, ) = payable(owner()).call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }
}