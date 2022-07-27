//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20Upgradeable.sol";
import "./AllowListUpgradeable.sol";
import "../INativeMinter.sol";

contract ERC20NativeMinterUpgradeable is
    ERC20Upgradeable,
    AllowListUpgradeable
{
    // Precompiled Native Minter Contract Address
    address constant MINTER_ADDRESS =
        0x0200000000000000000000000000000000000001;

    // Designated Blackhole Address
    address constant BLACKHOLE_ADDRESS =
        0x0100000000000000000000000000000000000000;

    INativeMinter nativeMinter;

    event Deposit(address indexed dst, uint256 wad);
    event Mintdrawal(address indexed src, uint256 wad);

    function __ERC20NativeMinter_init(
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _initSupply
    ) internal onlyInitializing {
        nativeMinter = INativeMinter(MINTER_ADDRESS);
        __ERC20_init(_tokenName, _tokenSymbol);
        __Ownable_init();
        // Mints INIT_SUPPLY to owner
        _mint(_msgSender(), _initSupply);
    }

    // Swaps [amount] number of ERC20 token for native coin.
    function mintdraw(uint256 wad) external {
        // Burn ERC20 token first.
        _burn(_msgSender(), wad);
        // Mints [amount] number of native coins (gas coin) to [msg.sender] address.
        // Calls NativeMinter precompile through INativeMinter interface.
        nativeMinter.mintNativeCoin(_msgSender(), wad);
        emit Mintdrawal(_msgSender(), wad);
    }

    // Swaps [amount] number of native gas coins for ERC20 tokens.
    function deposit() external payable {
        // Burn native token by sending to BLACKHOLE_ADDRESS
        payable(BLACKHOLE_ADDRESS).transfer(msg.value);
        // Mint ERC20 token.
        _mint(_msgSender(), msg.value);
        emit Deposit(_msgSender(), msg.value);
    }
}
