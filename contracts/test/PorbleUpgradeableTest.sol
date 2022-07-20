// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/draft-EIP712Upgradeable.sol";
import "../lib/upgradeable/ERC721RoyaltyUpgradeable.sol";
import "../lib/upgradeable/ContractURIStorageUpgradeable.sol";
import "../lib/upgradeable/OwnableUpgradeable.sol";
import "../lib/upgradeable/PausableUpgradeable.sol";

// @NOTE: Remove setBaseURI function to test the contract upgrade

contract PorbleUpgradeableTest is
    ERC721RoyaltyUpgradeable,
    ContractURIStorageUpgradeable,
    EIP712Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    string public baseURIString;

    // The expected signer of the signature required for minting and fusion
    address public signer;

    // The vault contract to deposit earned royalties
    address public vault;

    // Nested mapping that stores information on whether a user (address) has claimed a specific fusion signature
    // If it has been claimed, the fusion ID will map to true
    mapping(address => mapping(uint256 => bool)) public userFusionInfo;

    function initialize(address _signer, address _vault) public initializer {
        __ERC721_init("Portal Fantasy Porble", "PRBL");
        __EIP712_init("PortalFantasy", "1");
        __ContractURIStorage_init("https://www.portalfantasy.io/porble/");
        __Ownable_init();

        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
        signer = _signer;
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
     * Allows the caller to mint tokens with the specified tokenIds if the signature is valid
     * The recipient and the tokenIds to be minted is determined by the signer
     * @param signature the signed message specifying the recipient and tokenId to mint and transfer
     * @param tokenIds the tokenIds to mint and transfer to the caller
     */
    function safeMintTokens(
        bytes calldata signature,
        uint256[] calldata tokenIds
    ) external {
        // Only allow the caller to mint if the signature is valid
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "PorbleMintConditions(address minter,uint256[] tokenIds)"
                    ),
                    _msgSender(),
                    keccak256(abi.encodePacked(tokenIds))
                )
            )
        );

        address recoveredSigner = ECDSAUpgradeable.recover(digest, signature);

        require(
            signer == recoveredSigner,
            "PorbleMintConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        for (uint8 i = 0; i < tokenIds.length; i++) {
            _safeMint(_msgSender(), tokenIds[i]);
        }
    }

    /**
     * Allows the caller to fuse porbles. A fusion ID will be marked as having been completed. The sacrificed tokens are burnt.
     * @param signature the signed message specifying the fusion ID and the sacrificed porble's token IDs
     * @param fusionId the ID assigned by the backend for the fusion
     * @param sacrificialTokenIds the token IDs of the porbles that are to be sacrificed
     */
    function fuse(
        bytes calldata signature,
        uint256 fusionId,
        uint256[] calldata sacrificialTokenIds
    ) external {
        require(
            !userFusionInfo[_msgSender()][fusionId],
            "Fusion already complete"
        );

        // Only allow the caller to mint if the signature is valid
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "PorbleFusionConditions(address owner,uint256 fusionId,uint256[] sacrificialTokenIds)"
                    ),
                    _msgSender(),
                    fusionId,
                    keccak256(abi.encodePacked(sacrificialTokenIds))
                )
            )
        );

        address recoveredSigner = ECDSAUpgradeable.recover(digest, signature);

        require(
            signer == recoveredSigner,
            "PorbleFusionConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        for (uint8 i = 0; i < sacrificialTokenIds.length; i++) {
            uint256 sacrificialTokenId = sacrificialTokenIds[i];
            require(
                _isApprovedOrOwner(_msgSender(), sacrificialTokenId),
                "Token not approved for burn"
            );
            _burn(sacrificialTokenId);
        }

        // The sacrificial tokens have been burnt, so mark the fusion as complete
        userFusionInfo[_msgSender()][fusionId] = true;
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
     * @param _signer the address of the signer to point to
     */
    function setMintSigner(address _signer) external onlyOwner {
        signer = _signer;
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

    /**
     * Returns a boolean flag for whether the fusion has completed
     * @param user the address of the user that triggered the porble fusion
     * @param fusionId the fusion ID
     */
    function hasFusionCompleted(address user, uint256 fusionId)
        external
        view
        returns (bool)
    {
        return userFusionInfo[user][fusionId];
    }
}
