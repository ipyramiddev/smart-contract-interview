// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/IERC20Upgradeable.sol";
import "../lib/upgradeable/IERC2981Upgradeable.sol";
import "../lib/upgradeable/CountersUpgradeable.sol";
import "../lib/upgradeable/ERC721RoyaltyUpgradeable.sol";
import "../lib/upgradeable/ContractURIStorageUpgradeable.sol";
import "../lib/upgradeable/OwnableUpgradeable.sol";
import "../lib/upgradeable/PausableUpgradeable.sol";

contract ArchitectUpgradeable is
    ERC721RoyaltyUpgradeable,
    ContractURIStorageUpgradeable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    using CountersUpgradeable for CountersUpgradeable.Counter;

    CountersUpgradeable.Counter private _tokenIdCounter;

    string public baseURIString;

    // The architect mint price in USDP
    uint256 public mintPriceInUSDP;

    // The address of the USDP contract
    IERC20Upgradeable public USDP;

    // The vault contract to deposit earned USDP and royalties
    address public vault;

    function initialize(address _USDP, address _vault) public initializer {
        __ERC721_init("Portal Fantasy Architect", "PHAR");
        __ContractURIStorage_init("https://www.portalfantasy.io/architect/");
        __Ownable_init();

        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
        USDP = IERC20Upgradeable(_USDP);
        vault = _vault;

        // @TODO: Set the actual initial price in USDP to mint a Architect
        // 2 USDP initial price
        mintPriceInUSDP = 2000000000000000000;

        // Set the default token royalty to 4%
        _setDefaultRoyalty(vault, 400);
    }

    // @TODO: Have added a placeholder baseURI. Need to replace with actual when it's implemented.
    /**
     * Overriding the parent _baseURI() with required baseURI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURIString;
    }

    /**
     * Allows the caller to mint a token with a payment in USDP
     */
    function mintWithUSDP() external whenNotPaused {
        USDP.transferFrom(_msgSender(), vault, mintPriceInUSDP);
        _safeMint(_msgSender(), _tokenIdCounter.current());
        _tokenIdCounter.increment();
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
     * Allows the owner to set a new mint price in USDP
     * @param _mintPriceInUSDP the new mint price
     */
    function setMintPriceInUSDP(uint256 _mintPriceInUSDP) external onlyOwner {
        mintPriceInUSDP = _mintPriceInUSDP;
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
     * Allows the owner to set a new USDP contract address to point to
     * @param _USDP the new USDP address
     */
    function setUSDP(address _USDP) external onlyOwner {
        USDP = IERC20Upgradeable(_USDP);
    }

    /**
     * Allows the owner to set a new vault to deposit earned USDP
     * @param _vault the new address for the vault
     */
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
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
