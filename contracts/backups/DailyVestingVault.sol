// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/ERC20.sol";
import "../lib/Ownable.sol";
import "../lib/SafeMath.sol";

contract DailyVestingVault is Ownable {
    using SafeMath for uint256;
    using SafeMath for uint16;

    struct Grant {
        uint256 startTime; // The timestamp, after the cliff, at which the linear vesting starts
        uint256 amount; // The amount of tokens granted to the recipient. To be claimed over a linear vesting schedule
        uint16 vestingDuration; // The duration over which the linear vesting takes place
        uint16 daysClaimed; // The number of days worth of vested tokens that the recipient has claimed
        uint256 totalClaimed; // The total number of tokens that the recipent has claimed
        address recipient;
    }

    event GrantAdded(address indexed recipient);
    event GrantTokensClaimed(address indexed recipient, uint256 amountClaimed);
    event GrantRevoked(
        address recipient,
        uint256 amountVested,
        uint256 amountNotVested
    );

    ERC20 public token;

    mapping(address => Grant) private tokenGrants;

    uint256 public totalVestingCount;

    constructor(ERC20 _token) {
        require(address(_token) != address(0));
        token = _token;
    }

    function addTokenGrant(
        address _recipient,
        uint256 _amount,
        uint16 _vestingDurationInDays,
        uint16 _vestingCliffInDays
    ) external onlyOwner {
        require(
            tokenGrants[_recipient].amount == 0,
            "Grant already exists, must revoke first"
        );

        require(
            _vestingCliffInDays <= 10 * 365,
            "Cannot set a cliff greater than 10 years"
        );

        require(
            _vestingDurationInDays <= 25 * 365,
            "Cannot set a vesting duration greater than 25 years"
        );

        uint256 amountVestedPerDay = _amount.div(_vestingDurationInDays);

        require(
            amountVestedPerDay > 0,
            "The amount vested per day must be greater than zero"
        );

        // Transfer the grant tokens from the owner to the control of this contract
        require(
            token.transferFrom(owner(), address(this), _amount),
            "Token transfer from the owner to the vesting contract failed"
        );

        Grant memory grant = Grant({
            startTime: currentTime() + _vestingCliffInDays * 1 days,
            amount: _amount,
            vestingDuration: _vestingDurationInDays,
            daysClaimed: 0,
            totalClaimed: 0,
            recipient: _recipient
        });

        tokenGrants[_recipient] = grant;

        emit GrantAdded(_recipient);
    }

    // Allows a grant recipient to claim their vested tokens
    function claimVestedTokens() external {
        uint16 daysVested;
        uint256 amountVested;
        (daysVested, amountVested) = calculateGrantClaim(msg.sender);
        require(amountVested > 0, "No tokens have vested");

        Grant storage tokenGrant = tokenGrants[msg.sender];
        tokenGrant.daysClaimed = uint16(tokenGrant.daysClaimed.add(daysVested));
        tokenGrant.totalClaimed = uint256(
            tokenGrant.totalClaimed.add(amountVested)
        );

        require(
            token.transfer(tokenGrant.recipient, amountVested),
            "Vesting contract doesn't have sufficient tokens to send to the recipient"
        );

        emit GrantTokensClaimed(tokenGrant.recipient, amountVested);
    }

    // Terminate the token grant and transfer all vested tokens to the `_recipient`
    // Also returning all non-vested tokens to the contract owner
    // @param _recipient address of the token grant recipient
    function revokeTokenGrant(address _recipient) external onlyOwner {
        Grant storage tokenGrant = tokenGrants[_recipient];
        uint16 daysVested;
        uint256 amountVested;
        (daysVested, amountVested) = calculateGrantClaim(_recipient);

        // Of the amount remaining of the grant, there is a portion vested and a portion not vested
        uint256 amountNotVested = (
            tokenGrant.amount.sub(tokenGrant.totalClaimed)
        ).sub(amountVested);

        require(token.transfer(owner(), amountNotVested));
        require(token.transfer(_recipient, amountVested));

        tokenGrant.startTime = 0;
        tokenGrant.amount = 0;
        tokenGrant.vestingDuration = 0;
        tokenGrant.daysClaimed = 0;
        tokenGrant.totalClaimed = 0;
        tokenGrant.recipient = address(0);

        emit GrantRevoked(_recipient, amountVested, amountNotVested);
    }

    function getGrantStartTime(address _recipient)
        public
        view
        returns (uint256)
    {
        Grant storage tokenGrant = tokenGrants[_recipient];
        return tokenGrant.startTime;
    }

    function getGrantAmount(address _recipient) public view returns (uint256) {
        Grant storage tokenGrant = tokenGrants[_recipient];
        return tokenGrant.amount;
    }

    // Calculate the vested (days and amount) of tokens available for `_recipient` to claim
    // Due to rounding errors once grant duration is reached, returns the entire left grant amount
    function calculateGrantClaim(address _recipient)
        private
        view
        returns (uint16, uint256)
    {
        Grant storage tokenGrant = tokenGrants[_recipient];

        require(
            tokenGrant.totalClaimed < tokenGrant.amount,
            "Grant fully claimed"
        );

        // If the cliff has not been reached, return zeros
        if (currentTime() < tokenGrant.startTime) {
            return (0, 0);
        }

        uint256 elapsedDaysSinceCliffReached = currentTime()
            .sub(tokenGrant.startTime - 1 days)
            .div(1 days);

        // If over vesting duration, all tokens vested
        if (elapsedDaysSinceCliffReached >= tokenGrant.vestingDuration) {
            uint256 remainingGrant = tokenGrant.amount.sub(
                tokenGrant.totalClaimed
            );
            return (tokenGrant.vestingDuration, remainingGrant);
        } else {
            uint16 daysVested = uint16(
                elapsedDaysSinceCliffReached.sub(tokenGrant.daysClaimed)
            );
            uint256 amountVestedPerDay = tokenGrant.amount.div(
                uint256(tokenGrant.vestingDuration)
            );
            uint256 amountVested = uint256(daysVested.mul(amountVestedPerDay));
            return (daysVested, amountVested);
        }
    }

    function currentTime() private view returns (uint256) {
        return block.timestamp;
    }
}
