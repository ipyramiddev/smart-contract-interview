// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/OwnableUpgradeable.sol";
import "../lib/upgradeable/ReentrancyGuardUpgradeable.sol";

contract PFTStakingUpgradeable is
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    // One event to capture stake change information
    // Emitted when adding a new stake, increasing/decreasing a stake and completely unstaking
    event StakeUpdate(address indexed staker, int256 amount);

    struct StakeInfo {
        uint256 startTime; // The timestamp when the address started the staking
        uint256 amount; // The amount of PFT staked
    }

    // Stores the critical staking information for each address
    mapping(address => StakeInfo) private userStakes;

    // The minimum amount that must be staked to receive membership benefits
    uint256 public minimumStakeAmount;

    function initialize(uint256 _minimumStakeAmount) public initializer {
        require(
            _minimumStakeAmount > 0,
            "The minimum staking amount must be greater than zero"
        );
        minimumStakeAmount = _minimumStakeAmount;
        __ReentrancyGuard_init();
        __Ownable_init();
    }

    /**
     * Allows an address to stake PFT
     */
    function stake() external payable {
        uint256 stakedAmount = userStakes[msg.sender].amount;
        require(
            msg.value + stakedAmount >= minimumStakeAmount,
            "Staked amount would be less than the minimum required"
        );

        StakeInfo memory stakeInfo = userStakes[msg.sender];

        // We've already checked that the minimum staking amount requirement is being/was already met
        // So the address can stake the minimum amount or increase the stake by any additional amount they want
        stakeInfo.amount += msg.value;

        if (stakedAmount < minimumStakeAmount) {
            // The address is meeting the minimum stake amount requirement in this transaction, so must record the timestamp
            stakeInfo.startTime = block.timestamp;
        }
        userStakes[msg.sender] = stakeInfo;
        emit StakeUpdate(msg.sender, int256(msg.value));
    }

    /**
     * Allows an address to unstake all their staked PFT
     */
    function unstakeAll() external nonReentrant {
        uint256 stakedAmount = userStakes[msg.sender].amount;
        require(stakedAmount > 0, "The address doesn't have any staked PFT");
        delete userStakes[msg.sender];
        (bool success, ) = msg.sender.call{value: stakedAmount}("");
        require(success, "unstakeAll transfer failed");
        emit StakeUpdate(msg.sender, -int256(stakedAmount));
    }

    /**
     * Allows an address to unstake an exact amount of their staked PFT
     */
    function unstakeExactAmount(uint256 unstakeAmount) external nonReentrant {
        uint256 stakedAmount = userStakes[msg.sender].amount;
        require(stakedAmount > 0, "The address doesn't have any staked PFT");
        require(
            unstakeAmount <= stakedAmount,
            "Cannot unstake more than what is currently staked"
        );
        userStakes[msg.sender].amount -= unstakeAmount;
        (bool success, ) = msg.sender.call{value: unstakeAmount}("");
        require(success, "unstake PFT transfer failed");
        emit StakeUpdate(msg.sender, -int256(unstakeAmount));
    }

    /**
     * Allows an address to unstake any excess amount of PFT staked above the minimum staking amount
     */
    function unstakeExcessAmount() external nonReentrant {
        uint256 stakedAmount = userStakes[msg.sender].amount;
        uint256 excessAmount = stakedAmount - minimumStakeAmount;
        require(excessAmount > 0, "The address doesn't have excess PFT staked");
        userStakes[msg.sender].amount = minimumStakeAmount;
        (bool success, ) = msg.sender.call{value: excessAmount}("");
        require(success, "unstake PFT transfer failed");
        emit StakeUpdate(msg.sender, -int256(excessAmount));
    }

    /**
     * Returns the stake info for a particular staker address
     * @param staker the staker's address
     */
    function getStakeInfo(address staker)
        external
        view
        returns (StakeInfo memory)
    {
        return userStakes[staker];
    }

    /**
     * Allows the owner to change the minimum stake amount
     * @param _minimumStakeAmount the new minimum stake amount
     */
    function setMinimumStakeAmount(uint256 _minimumStakeAmount)
        external
        onlyOwner
    {
        require(
            _minimumStakeAmount > 0,
            "The new minimum staking amount must be greater than zero"
        );
        minimumStakeAmount = _minimumStakeAmount;
    }
}
