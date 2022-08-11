// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/ContractURIStorageUpgradeable.sol";
import "../lib/upgradeable/ONFT721Upgradeable.sol";

// @NOTE: Remove setBaseURI function to test the contract upgrade

contract PorbleONFTExternalUpgradeableTest is
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
        __ONFT721Upgradeable_init("Portal Fantasy Porble", "PRBL", _lzEndpoint);
        __ContractURIStorage_init("https://www.portalfantasy.io/porble/");

        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
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
     * Allows the owner to set a new default royalty which applies to all tokens in absence of a specific token royalty
     * @param _feeNumerator in bips. Cannot be greater than the fee denominator (10000)
     */
    function setDefaultRoyalty(uint96 _feeNumerator) external onlyOwner {
        _setDefaultRoyalty(vault, _feeNumerator);
    }
}
