// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/ERC20Upgradeable.sol";
import "../lib/upgradeable/OwnableUpgradeable.sol";
import "../lib/upgradeable/Initializable.sol";

// @NOTE: Remove mint function to test the contract upgrade

contract USDPUpgradeableTest is ERC20Upgradeable, OwnableUpgradeable {
    // Mapping from an address to whether or not it can mint / burn
    mapping(address => bool) public controllers;

    function initialize() public initializer {
        __ERC20_init("Portal Fantasy USD", "USDP");
        __Ownable_init();
    }

    /**
     * Burns USDP from a holder
     * @param from the holder of the USDP
     * @param amount the amount of USDP to burn
     */
    function burn(address from, uint256 amount) external {
        require(controllers[msg.sender], "Only controllers can burn");
        _burn(from, amount);
    }

    /**
     * Enables an address to mint / burn
     * @param controller the address to enable
     */
    function addController(address controller) external onlyOwner {
        controllers[controller] = true;
    }

    /**
     * Disables an address from minting / burning
     * @param controller the address to disbale
     */
    function removeController(address controller) external onlyOwner {
        controllers[controller] = false;
    }
}
