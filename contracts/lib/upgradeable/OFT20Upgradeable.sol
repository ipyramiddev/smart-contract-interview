// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./ERC20Upgradeable.sol";
import "./IERC165Upgradeable.sol";
import "./OFT20CoreUpgradeable.sol";
import "../IOFT20.sol";

// override decimal() function is needed
contract OFT20Upgradeable is OFT20CoreUpgradeable, ERC20Upgradeable, IOFT20 {
    function __OFT20Upgradeable_init(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint
    ) internal onlyInitializing {
        __ERC20_init(_name, _symbol);
        __OFT20CoreUpgradeable_init(_lzEndpoint);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(OFT20CoreUpgradeable, IERC165Upgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IOFT20).interfaceId ||
            interfaceId == type(IERC20Upgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function circulatingSupply()
        public
        view
        virtual
        override
        returns (uint256)
    {
        return totalSupply();
    }

    function _debitFrom(
        address _from,
        uint16,
        bytes memory,
        uint256 _amount
    ) internal virtual override {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        _burn(_from, _amount);
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint256 _amount
    ) internal virtual override {
        _mint(_toAddress, _amount);
    }
}
