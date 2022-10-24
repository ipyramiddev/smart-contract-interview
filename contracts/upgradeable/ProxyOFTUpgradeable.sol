// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/OFT20CoreUpgradeable.sol";
import "../lib/upgradeable/SafeERC20Upgradeable.sol";

contract ProxyOFTUpgradeable is OFT20CoreUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    IERC20Upgradeable public token;

    function initialize(address _lzEndpoint, address _proxyToken)
        public
        initializer
    {
        __OFT20CoreUpgradeable_init(_lzEndpoint);
        token = IERC20Upgradeable(_proxyToken);
    }

    function circulatingSupply()
        public
        view
        virtual
        override
        returns (uint256)
    {
        unchecked {
            return token.totalSupply() - token.balanceOf(address(this));
        }
    }

    function _debitFrom(
        address _from,
        uint16,
        bytes memory,
        uint256 _amount
    ) internal virtual override {
        require(_from == _msgSender(), "ProxyOFT: owner is not send caller");
        token.safeTransferFrom(_from, address(this), _amount);
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint256 _amount
    ) internal virtual override {
        token.safeTransfer(_toAddress, _amount);
    }
}
