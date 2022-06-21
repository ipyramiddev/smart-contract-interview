// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/draft-EIP712Upgradeable.sol";
import "../lib/upgradeable/ERC721RoyaltyUpgradeable.sol";
import "../lib/upgradeable/ContractURIStorageUpgradeable.sol";
import "../lib/upgradeable/OwnableUpgradeable.sol";
import "../lib/upgradeable/PausableUpgradeable.sol";

contract PorbleUpgradeable is
    ERC721RoyaltyUpgradeable,
    ContractURIStorageUpgradeable,
    EIP712Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    string public baseURIString;

    // The expected signer of the signature required for minting
    address public mintSigner;

    // The vault contract to deposit earned royalties
    address public vault;

    function initialize(address _signer, address _vault) public initializer {
        __ERC721_init("Portal Fantasy Porble", "PRBL");
        __EIP712_init("PortalFantasy", "1");
        __ContractURIStorage_init("https://www.portalfantasy.io/porble/");
        __Ownable_init();

        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
        mintSigner = _signer;
        vault = _vault;

        // Set the default token royalty to 4%
        _setDefaultRoyalty(vault, 400);
    }

    /**
     * Overriding the parent _baseURI() with required baseURI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURIString;
    }

    /**
     * Allows the caller to mint a token with specified tokenId if the signature is valid
     * The recipient and the tokenId to be minted is determined by the signer
     * @param signature the signed message specifying the recipient and tokenId to mint and transfer
     * @param tokenId the tokenId to mint and transfer to the caller
     */
    function safeMint(bytes calldata signature, uint256 tokenId) external {
        // Only allow the caller to mint if the signature is valid
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "PorbleMintConditions(address minter,uint256 tokenId)"
                    ),
                    _msgSender(),
                    tokenId
                )
            )
        );

        address signer = ECDSAUpgradeable.recover(digest, signature);

        require(
            signer == mintSigner,
            "PorbleMintConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        _safeMint(_msgSender(), tokenId);
    }

    /**
     * Allows the owner to set a new base URI
     * @param _baseURIString the new base URI to point to
     */
    function setBaseURIString(string calldata _baseURIString)
        external
        onlyOwner
    {
        baseURIString = _baseURIString;
    }

    /**
     * Allows the owner to set a new contract URI
     * @param _contractURIString the new contract URI to point to
     */
    function setContractURIString(string calldata _contractURIString)
        external
        onlyOwner
    {
        _setContractURIString(_contractURIString);
    }

    /**
     * Set the address of the signer which can sign messages specifying the mint conditions
     * @param signer the address of the signer to point to
     */
    function setMintSigner(address signer) external onlyOwner {
        mintSigner = signer;
    }

    /**
     * Enable the owner to pause / unpause minting
     * @param _paused paused when set to `true`, unpause when set to `false`
     */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }

    /**
     * Allows the owner to set a new default royalty which applies to all tokens in absence of a specific token royalty
     * @param _feeNumerator in bips. Cannot be greater than the fee denominator (10000)
     */
    function setDefaultRoyalty(uint96 _feeNumerator) external onlyOwner {
        _setDefaultRoyalty(vault, _feeNumerator);
    }

    /**
     * Allows the owner to set a custom royalty for a specific token
     * @param _tokenId the token to set a custom royalty for
     * @param _feeNumerator in bips. Cannot be greater than the fee denominator (10000)
     */
    function setTokenRoyalty(uint256 _tokenId, uint96 _feeNumerator)
        external
        onlyOwner
    {
        _setTokenRoyalty(_tokenId, vault, _feeNumerator);
    }

    /**
     * Allows the owner to reset a specific token's royalty to the global default
     * @param _tokenId the token to set a custom royalty for
     */
    function resetTokenRoyalty(uint256 _tokenId) external onlyOwner {
        _resetTokenRoyalty(_tokenId);
    }
}
