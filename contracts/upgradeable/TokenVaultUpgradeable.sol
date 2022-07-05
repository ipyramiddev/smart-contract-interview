// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/IERC20Upgradeable.sol";
import "../lib/upgradeable/draft-EIP712Upgradeable.sol";
import "../lib/upgradeable/OwnableUpgradeable.sol";
import "../lib/upgradeable/ReentrancyGuardUpgradeable.sol";

contract TokenVaultUpgradeable is
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable,
    OwnableUpgradeable
{
    // A negative amount corresponds to a refund
    event Payment(address indexed user, uint256 opId, int256 amount);

    // Nested mapping that stores the amount an address as paid for a particular game operation Id (opId)
    // E.g. if a player has paid 10 PFT for an operation with opId 1, and 15 PFT for an operation with opId 2
    mapping(address => mapping(uint256 => uint256)) public userPaymentsInfo;

    // Mapping used to keep track of the number of claim calls an address has made
    mapping(address => uint256) public callerToClaimId;

    // The expected signer of the signature required for transferring PFT from the vault to the caller
    address public PFTVaultTransferSigner;

    function initialize(address signer) public initializer {
        __ReentrancyGuard_init();
        __EIP712_init("PortalFantasy", "1");
        __Ownable_init();

        PFTVaultTransferSigner = signer;
    }

    /**
     * Allows an address to pay for a specific game operation (e.g. synthesizing porbles)
     * @param opId the operation Id that the address wants to pay for
     */
    function payForOpId(uint256 opId) external payable {
        require(msg.value > 0, "The caller hasn't sent any PFT");
        require(
            userPaymentsInfo[msg.sender][opId] == 0,
            "There is already a user payment associated with this opId"
        );
        userPaymentsInfo[msg.sender][opId] = msg.value;
        emit Payment(msg.sender, opId, int256(msg.value));
    }

    /**
     * Allows the contract owner to issue a user a full refund
     * @param user the address of the user that made the payment
     * @param opId the operation Id that the user made the payment in relation to
     */
    function issueFullRefund(address user, uint256 opId)
        external
        onlyOwner
        nonReentrant
    {
        uint256 refundAmount = userPaymentsInfo[user][opId];
        require(
            refundAmount > 0,
            "There is no refund to issue for this combination of user and opId"
        );
        delete userPaymentsInfo[user][opId];
        (bool success, ) = payable(user).call{value: refundAmount}("");
        require(success, "refund failed");
        emit Payment(user, opId, -int256(refundAmount));
    }

    /**
     * Sets the only valid signer of transfers from the vault contract
     * @param signer the address of the signer to point to
     */
    function setPFTVaultTransferSigner(address signer) external onlyOwner {
        PFTVaultTransferSigner = signer;
    }

    /**
     * Allows the caller to transfer an amount of PFT tokens from this contract
     * The amount to be transferred is determined by the signer
     * @param signature the signed message specifying the recipient and amount of tokens to transfer
     * @param amount the amount of tokens to transfer
     */
    function transferFromVault(bytes calldata signature, uint256 amount)
        external
        nonReentrant
    {
        // Transfer PFT from this contract to the caller if the signature is valid
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "PFTVaultTransferConditions(address recipient,uint256 amount,uint256 claimId)"
                    ),
                    msg.sender,
                    amount,
                    callerToClaimId[msg.sender]
                )
            )
        );

        address signer = ECDSAUpgradeable.recover(digest, signature);

        require(
            signer == PFTVaultTransferSigner,
            "PFTVaultTransferConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        callerToClaimId[msg.sender]++;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "PFT claim withdrawal failed");
    }

    /**
     * Returns the user payment amount for a particular operation Id
     * @param user the address of the user that made the payment
     * @param opId the operation Id that the user made the payment in relation to
     */
    function getUserPaymentAmountForOpId(address user, uint256 opId)
        external
        view
        returns (uint256)
    {
        return userPaymentsInfo[user][opId];
    }

    /**
     * Allows the contract owner (should be MultiSigWallet) to withdraw a specific amount of PFT to an address
     * @param to the address to withdraw the PFT to
     * @param amount the amount of PFT to withdraw from this contract
     */
    function withdrawPFT(address to, uint256 amount)
        external
        onlyOwner
        nonReentrant
    {
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "withdraw failed");
    }

    /**
     * Allows the contract owner (should be MultiSigWallet) to withdraw a specific amount of ERC20 tokens to an address
     * @param token the ERC20 token address, e.g. USDP
     * @param to the address to withdraw the PFT to
     * @param amount the amount of PFT to withdraw from this contract
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
