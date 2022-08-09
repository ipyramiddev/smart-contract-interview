// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/OFT20Upgradeable.sol";
import "../lib/upgradeable/IERC20Upgradeable.sol";
import "../lib/upgradeable/Initializable.sol";

contract OPFTExternalUpgradeableTest is OFT20Upgradeable {
    uint256 public testNum;

    function initialize(address _lzEndpoint) public initializer {
        __OFT20Upgradeable_init("Portal Fantasy Token", "PFT", _lzEndpoint);
    }

    function setTestNum(uint256 _testNum) external {
        testNum = _testNum;
    }
}
