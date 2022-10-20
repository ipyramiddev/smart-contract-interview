// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/ERC20Upgradeable.sol";
import "../lib/upgradeable/IERC165Upgradeable.sol";
import "../lib/upgradeable/OFT20CoreUpgradeable.sol";
import "../lib/upgradeable/IOFT20Upgradeable.sol";

contract WrappedOFTUpgradeable is
    OFT20CoreUpgradeable,
    ERC20Upgradeable,
    IOFT20Upgradeable
{
    mapping(uint16 => uint256) public remoteBalances;

    function initialize(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint
    ) public initializer {
        __ERC20_init(_name, _symbol);
        __OFT20CoreUpgradeable_init(_lzEndpoint);
    }

    function decimals() public view override returns (uint8) {
        return 6;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(OFT20CoreUpgradeable, IERC165Upgradeable)
        returns (bool)
    {
        return
            interfaceId == type(IOFT20Upgradeable).interfaceId ||
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
        uint16 _dstChainId,
        bytes memory,
        uint256 _amount
    ) internal virtual override {
        address spender = _msgSender();
        if (_from != spender) _spendAllowance(_from, spender, _amount);
        require(
            remoteBalances[_dstChainId] >= _amount,
            "WrappedOFT: Not enough balance on destination chain"
        );
        remoteBalances[_dstChainId] -= _amount;
        _burn(_from, _amount);
    }

    function _creditTo(
        uint16 _srcChainId,
        address _toAddress,
        uint256 _amount
    ) internal virtual override {
        remoteBalances[_srcChainId] += _amount;
        _mint(_toAddress, _amount);
    }
}
