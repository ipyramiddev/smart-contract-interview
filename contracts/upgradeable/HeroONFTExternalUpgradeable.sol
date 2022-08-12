// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/ContractURIStorageUpgradeable.sol";
import "../lib/upgradeable/ONFT721Upgradeable.sol";

contract HeroONFTExternalUpgradeable is
    ContractURIStorageUpgradeable,
    ONFT721Upgradeable
{
    string public baseURIString;

    // The vault contract to deposit earned royalties
    address public vault;

    function initialize(address _vault, address _lzEndpoint)
        public
        initializer
    {
        __ONFT721Upgradeable_init("Portal Fantasy Hero", "PHRO", _lzEndpoint);
        __ContractURIStorage_init("https://www.portalfantasy.io/hero/");

        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
        vault = _vault;

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
     * Allows the owner to set a new vault to deposit earned royalties
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
}
