// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/IERC20Upgradeable.sol";
import "../lib/upgradeable/OwnableUpgradeable.sol";
import "../lib/upgradeable/PausableUpgradeable.sol";
import "../lib/upgradeable/ReentrancyGuardUpgradeable.sol";

// @NOTE: Remove withdrawAVAX function to test the contract upgrade

contract TokenVaultExternalUpgradeableTest is
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    function initialize() public initializer {
        __ReentrancyGuard_init();
        __Ownable_init();
    }

    /**
     * Allows the contract owner (should be MultiSigWallet) to withdraw a specific amount of ERC20 tokens to an address
     * @param token the ERC20 token address, e.g. USDP
     * @param to the address to withdraw the token to
     * @param amount the amount of the token to withdraw from this contract
     */
    function withdrawTokens(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        bool success = IERC20Upgradeable(token).transfer(to, amount);
        require(success, "withdraw failed");
    }

    fallback() external payable {}

    receive() external payable {}
}
