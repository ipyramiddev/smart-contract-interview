// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./lib/draft-EIP712Upgradeable.sol";
import "./lib/ERC20Upgradeable.sol";
import "./lib/OwnableUpgradeable.sol";
import "./lib/Initializable.sol";

contract PORBUpgradeable is
    ERC20Upgradeable,
    EIP712Upgradeable,
    OwnableUpgradeable
{
    // Mapping from an address to whether or not it can mint / burn
    mapping(address => bool) public controllers;

    // Mapping used to keep track of the number of claim calls an address has made
    mapping(address => uint256) public callerToClaimId;

    // The address of the PORB vault contract
    address public PORBVault;

    // The expected signer of the signature required for transferring PORB from the vault to the caller
    address public PORBVaultTransferSigner;

    function initialize(address signer, address vault) public initializer {
        __ERC20_init("Portal Fantasy Orb", "PORB");
        __EIP712_init("PortalFantasy", "1");
        __Ownable_init();

        // Only allowed to set during construction to protect balances of all owners
        PORBVault = vault;

        PORBVaultTransferSigner = signer;
    }

    /**
     * Mints PORB to a recipient
     * @param to the recipient of the PORB
     * @param amount the amount of PORB to mint
     */
    function mint(address to, uint256 amount) external {
        require(controllers[msg.sender], "Only controllers can mint");
        _mint(to, amount);
    }

    /**
     * Burns PORB from a holder
     * @param from the holder of the PORB
     * @param amount the amount of PORB to burn
     */
    function burn(address from, uint256 amount) external {
        require(controllers[msg.sender], "Only controllers can burn");
        _burn(from, amount);
    }

    /**
     * Enables an address to mint / burn
     * @param controller the address to enable
     */
    function addController(address controller) external onlyOwner {
        controllers[controller] = true;
    }

    /**
     * Disables an address from minting / burning
     * @param controller the address to disbale
     */
    function removeController(address controller) external onlyOwner {
        controllers[controller] = false;
    }

    /**
     * Sets the only valid signer of transfers from the vault contract
     * @param signer the address of the signer to point to
     */
    function setPORBVaultTransferSigner(address signer) external onlyOwner {
        PORBVaultTransferSigner = signer;
    }

    /**
     * Allows the caller to transfer an amount of PORB tokens from the vault contract
     * The amount to be transferred is determined by the signer
     * @param signature the signed message specifying the recipient and amount of tokens to transfer
     * @param amount the amount of tokens to transfer from the vault
     */
    function transferFromVault(bytes calldata signature, uint256 amount)
        external
    {
        // Only allow the caller to transfer from the PORB vault if the signature is valid
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "PORBVaultTransferConditions(address recipient,uint256 amount,uint256 claimId)"
                    ),
                    _msgSender(),
                    amount,
                    callerToClaimId[_msgSender()]
                )
            )
        );

        address signer = ECDSAUpgradeable.recover(digest, signature);

        require(
            signer == PORBVaultTransferSigner,
            "PORBVaultTransferConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        _approve(PORBVault, _msgSender(), amount);
        transferFrom(PORBVault, _msgSender(), amount);

        callerToClaimId[_msgSender()]++;
    }
}
