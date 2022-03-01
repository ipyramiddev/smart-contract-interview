// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./lib/BokkyPooBahsDateTimeLibrary.sol";
import "./lib/ERC20.sol";
import "./lib/Ownable.sol";
import "./lib/SafeMath.sol";

contract VestingVault is Ownable {
    using BokkyPooBahsDateTimeLibrary for uint256;
    using SafeMath for uint256;
    using SafeMath for uint16;

    struct Grant {
        uint256 startTime; // The timestamp, after the cliff, at which the linear vesting starts
        uint256 amount; // The amount of tokens granted to the recipient. To be claimed over a linear vesting schedule
        uint16 vestingDuration; // The duration over which the linear vesting takes place
        uint16 monthsClaimed; // The number of months worth of vested tokens that the recipient has claimed
        uint256 totalClaimed; // The total number of tokens that the recipent has claimed
    }

    event GrantAdded(address indexed recipient);
    event GrantTokensClaimed(address indexed recipient, uint256 amountClaimed);
    event GrantRevoked(
        address recipient,
        uint256 amountVested,
        uint256 amountNotVested
    );

    ERC20 public token;

    // Recipient to Grant mapping
    mapping(address => Grant) private tokenGrants;

    uint256 public totalVestingCount;

    constructor(ERC20 _token) {
        require(address(_token) != address(0));
        token = _token;
    }

    function addTokenGrant(
        address _recipient,
        uint256 _amount,
        uint16 _vestingDurationInMonths,
        uint16 _vestingCliffInMonths
    ) external onlyOwner {
        require(
            tokenGrants[_recipient].amount == 0,
            "Grant already exists, must revoke first"
        );

        require(
            _vestingCliffInMonths <= 5 * 12,
            "Cannot set a cliff greater than 5 years"
        );

        require(
            _vestingDurationInMonths <= 10 * 12,
            "Cannot set a vesting duration greater than 10 years"
        );

        uint256 amountVestedPerMonth = _amount.div(_vestingDurationInMonths);

        require(
            amountVestedPerMonth > 0,
            "The amount vested per month must be greater than zero"
        );

        // Transfer the grant tokens from the owner to the control of this contract
        require(
            token.transferFrom(owner(), address(this), _amount),
            "Token transfer from the owner to the vesting contract failed"
        );

        Grant memory grant = Grant({
            startTime: BokkyPooBahsDateTimeLibrary.addMonths(
                block.timestamp,
                _vestingCliffInMonths
            ),
            amount: _amount,
            vestingDuration: _vestingDurationInMonths,
            monthsClaimed: 0,
            totalClaimed: 0
        });

        tokenGrants[_recipient] = grant;

        emit GrantAdded(_recipient);
    }

    // Allows a grant recipient to claim their vested tokens
    function claimVestedTokensForRecipient(address _recipient)
        external
        onlyOwner
    {
        uint16 monthsVested;
        uint256 amountVested;
        (monthsVested, amountVested) = calculateGrantClaim(_recipient);
        require(amountVested > 0, "No tokens have vested");

        Grant storage tokenGrant = tokenGrants[_recipient];
        tokenGrant.monthsClaimed = uint16(
            tokenGrant.monthsClaimed.add(monthsVested)
        );
        tokenGrant.totalClaimed = uint256(
            tokenGrant.totalClaimed.add(amountVested)
        );

        require(
            token.transfer(_recipient, amountVested),
            "Vesting contract doesn't have sufficient tokens to send to the recipient"
        );

        emit GrantTokensClaimed(_recipient, amountVested);
    }

    // Terminate the token grant and transfer all vested tokens to the `_recipient`
    // Also returning all non-vested tokens to the contract owner
    // @param _recipient address of the token grant recipient
    function revokeTokenGrant(address _recipient) external onlyOwner {
        Grant storage tokenGrant = tokenGrants[_recipient];
        uint256 amountVested;
        (, amountVested) = calculateGrantClaim(_recipient);

        // Of the amount remaining of the grant, there is a portion vested and a portion not vested
        uint256 amountNotVested = (
            tokenGrant.amount.sub(tokenGrant.totalClaimed)
        ).sub(amountVested);

        require(token.transfer(owner(), amountNotVested));
        require(token.transfer(_recipient, amountVested));

        delete tokenGrants[_recipient];

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

    function getGrantMonthsClaimed(address _recipient)
        public
        view
        returns (uint16)
    {
        Grant storage tokenGrant = tokenGrants[_recipient];
        return tokenGrant.monthsClaimed;
    }

    // Calculate the vested (months and amount) of tokens available for `_recipient` to claim
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
        if (block.timestamp < tokenGrant.startTime) {
            return (0, 0);
        }

        uint256 elapsedMonthsSinceCliffReached = BokkyPooBahsDateTimeLibrary
            .diffMonths(tokenGrant.startTime, block.timestamp);

        if (elapsedMonthsSinceCliffReached >= tokenGrant.vestingDuration) {
            uint256 remainingMonths = tokenGrant.vestingDuration.sub(
                tokenGrant.monthsClaimed
            );

            uint256 remainingGrant = tokenGrant.amount.sub(
                tokenGrant.totalClaimed
            );

            return (uint16(remainingMonths), remainingGrant);
        } else {
            uint16 monthsVested = uint16(
                elapsedMonthsSinceCliffReached.sub(tokenGrant.monthsClaimed)
            );
            uint256 amountVestedPerMonth = tokenGrant.amount.div(
                uint256(tokenGrant.vestingDuration)
            );
            uint256 amountVested = uint256(
                monthsVested.mul(amountVestedPerMonth)
            );
            return (monthsVested, amountVested);
        }
    }
}
