// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../../lib/upgradeable/ERC20Upgradeable.sol";
import "../../lib/upgradeable/IERC20Upgradeable.sol";
import "../../lib/upgradeable/OwnableUpgradeable.sol";
import "../../lib/upgradeable/Initializable.sol";

contract PFTUpgradeable is ERC20Upgradeable, OwnableUpgradeable {
    // Mapping from an address to whether or not it can mint / burn
    mapping(address => bool) public controllers;

    function initialize() public initializer {
        __ERC20_init("Portal Fantasy Token", "PFT");
        __Ownable_init();
    }

    /**
     * Mints PORB to a recipient
     * @param to the recipient of the PORB
     * @param amount the amount of PORB to mint
     */
    function mint(address to, uint256 amount) external {
        require(controllers[msg.sender], "Only controllers can mint");
        _mint(to, amount);
    }

    /**
     * Burns PORB from a holder
     * @param from the holder of the PORB
     * @param amount the amount of PORB to burn
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
