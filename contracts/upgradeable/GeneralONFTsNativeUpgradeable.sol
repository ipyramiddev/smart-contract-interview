// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/draft-EIP712Upgradeable.sol";
import "../lib/upgradeable/ContractURIStorageUpgradeable.sol";
import "../lib/upgradeable/ONFT721Upgradeable.sol";
import "../lib/upgradeable/IERC20Upgradeable.sol";

contract GeneralONFTsNativeUpgradeable is
    ContractURIStorageUpgradeable,
    EIP712Upgradeable,
    ONFT721Upgradeable
{
    string public baseURIString;

    // The expected signer of the signature required for minting
    address public mintSigner;

    // The address of the ERC20 token used to pay for the hero tokens
    IERC20Upgradeable public tokenToPay;

    // The vault contract to deposit earned ERC20/PFT and royalties
    address public vault;

    // Flag for allowing PFT payments
    bool public isPFTPaymentEnabled;

    // Flag for allowing ERC20 payments
    bool public isERC20PaymentEnabled;

    function initialize(
        address _signer,
        address _tokenToPay,
        address _vault,
        address _lzEndpoint
    ) public initializer {
        __ONFT721Upgradeable_init(
            "Portal Fantasy General NFTs",
            "PFGN",
            _lzEndpoint
        );
        __EIP712_init("PortalFantasy", "1");
        __ContractURIStorage_init("https://www.portalfantasy.io/generalNFTs/");

        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
        mintSigner = _signer;
        tokenToPay = IERC20Upgradeable(_tokenToPay);
        vault = _vault;
        isPFTPaymentEnabled = true;

        // Set the default token royalty to 4%
        _setDefaultRoyalty(vault, 400);
    }

    // @TODO: Have added a placeholder baseURI. Need to replace with actual when it's implemented.
    /**
     * Overriding the parent _baseURI() with required baseURI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURIString;
    }

    /**
     * Allows the owner to set a new base URI
     * @param _baseURIString the new base URI to point to
     */
    function setBaseURIString(string calldata _baseURIString)
        external
        onlyOwner
    {
        baseURIString = _baseURIString;
    }

    /**
     * Allows the owner to set a new contract URI
     * @param _contractURIString the new contract URI to point to
     */
    function setContractURIString(string calldata _contractURIString)
        external
        onlyOwner
    {
        _setContractURIString(_contractURIString);
    }

    /**
     * Set the address of the signer which can sign messages specifying the mint conditions
     * @param signer the address of the signer to point to
     */
    function setMintSigner(address signer) external onlyOwner {
        mintSigner = signer;
    }

    /**
     * Set flag for whether PFT payments is currently enabled on this contract
     * @param enabled the updated flag state
     */
    function setIsPFTPaymentEnabled(bool enabled) external onlyOwner {
        isPFTPaymentEnabled = enabled;
    }

    /**
     * Set flag for whether ERC20 payments is currently enabled on this contract
     * @param enabled the updated flag state
     */
    function setIsERC20PaymentEnabled(bool enabled) external onlyOwner {
        isERC20PaymentEnabled = enabled;
    }

    /**
     * Allows the caller to mint tokens with the specified tokenIds and tokenPrices if the signature is valid
     * The recipient, tokenIds, tokenPrices and payment method for minting is determined by the signer
     * @param signature the signed message specifying the recipient and tokenId to mint and transfer
     * @param tokenIds the tokenIds to mint and transfer to the caller
     * @param tokenPrices the prices of the tokenIds mapped 1:1
     * @param isPaymentInPFT flag indicating whether the payment is in PFT or the ERC20 token
     */
    function safeMintTokens(
        bytes calldata signature,
        uint256[] calldata tokenIds,
        uint256[] calldata tokenPrices,
        bool isPaymentInPFT
    ) external payable {
        // Only allow the caller to mint if the signature is valid
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "GeneralNFTMintConditions(address minter,uint256[] tokenIds,uint256[] tokenPrices,bool isPaymentInPFT)"
                    ),
                    _msgSender(),
                    keccak256(abi.encodePacked(tokenIds)),
                    keccak256(abi.encodePacked(tokenPrices)),
                    isPaymentInPFT
                )
            )
        );

        address signer = ECDSAUpgradeable.recover(digest, signature);

        require(
            signer == mintSigner,
            "GeneralNFTMintConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        for (uint8 i = 0; i < tokenIds.length; i++) {
            if (isPaymentInPFT) {
                // 1 -> "PFT payments not enabled"
                require(isPFTPaymentEnabled, "1");
                (bool success, ) = address(vault).call{value: tokenPrices[i]}(
                    ""
                );
                // 2 -> "token payment failed""
                require(success, "2");
            } else {
                // Payment is assumed to be in ERC20
                // 3 -> "ERC20 payments not enabled"
                require(isERC20PaymentEnabled, "3");
                tokenToPay.transferFrom(_msgSender(), vault, tokenPrices[i]);
            }
            _safeMint(_msgSender(), tokenIds[i]);
        }
    }

    /**
     * Allows the caller to burn tokens they own or have been approved to handle.
     * @param tokenIds the token IDs of the NFTs that are to be burnt
     */
    function burnTokens(uint256[] calldata tokenIds) external {
        for (uint8 i = 0; i < tokenIds.length; i++) {
            require(
                _isApprovedOrOwner(_msgSender(), tokenIds[i]),
                "Burn not approved"
            );
            _burn(tokenIds[i]);
        }
    }

    /**
     * Allows the owner to set a new ERC20 token contract address to point to
     * @param _tokenToPay the new ERC20 address
     */
    function setTokenToPay(address _tokenToPay) external onlyOwner {
        tokenToPay = IERC20Upgradeable(_tokenToPay);
    }

    /**
     * Allows the owner to set a new vault to deposit earned ERC20 tokens
     * @param _vault the new address for the vault
     */
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    /**
     * Allows the owner to set a new default royalty which applies to all tokens in absence of a specific token royalty
     * @param _feeNumerator in bips. Cannot be greater than the fee denominator (10000)
     */
    function setDefaultRoyalty(uint96 _feeNumerator) external onlyOwner {
        _setDefaultRoyalty(vault, _feeNumerator);
    }
}
