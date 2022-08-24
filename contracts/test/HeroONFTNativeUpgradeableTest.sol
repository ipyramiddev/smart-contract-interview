// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/draft-EIP712Upgradeable.sol";
import "../lib/upgradeable/ContractURIStorageUpgradeable.sol";
import "../lib/upgradeable/ONFT721Upgradeable.sol";
import "../lib/upgradeable/IERC20Upgradeable.sol";

// @NOTE: Remove setBaseURIString function to test the contract upgrade

contract HeroONFTNativeUpgradeableTest is
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

    function initialize(
        address _signer,
        address _tokenToPay,
        address _vault,
        address _lzEndpoint
    ) public initializer {
        __ONFT721Upgradeable_init("Portal Fantasy Hero", "PHRO", _lzEndpoint);
        __EIP712_init("PortalFantasy", "1");
        __ContractURIStorage_init("https://www.portalfantasy.io/hero/");

        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
        mintSigner = _signer;
        tokenToPay = IERC20Upgradeable(_tokenToPay);
        vault = _vault;

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
     * Allows the caller to mint tokens with the specified tokenIds and tokenPrices if the signature is valid
     * The recipient, tokenIds and tokenPrices to be minted is determined by the signer
     * @param signature the signed message specifying the recipient and tokenId to mint and transfer
     * @param tokenIds the tokenIds to mint and transfer to the caller
     * @param tokenPrices the prices of the tokenIds mapped 1:1
     */
    function safeMintTokens(
        bytes calldata signature,
        uint256[] calldata tokenIds,
        uint256[] calldata tokenPrices
    ) external {
        // Only allow the caller to mint if the signature is valid
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "HeroMintConditions(address minter,uint256[] tokenIds,uint256[] tokenPrices)"
                    ),
                    _msgSender(),
                    keccak256(abi.encodePacked(tokenIds)),
                    keccak256(abi.encodePacked(tokenPrices))
                )
            )
        );

        address signer = ECDSAUpgradeable.recover(digest, signature);

        require(signer == mintSigner, "HeroMintConditions: invalid signature");
        require(signer != address(0), "ECDSA: invalid signature");

        for (uint8 i = 0; i < tokenIds.length; i++) {
            tokenToPay.transferFrom(_msgSender(), vault, tokenPrices[i]);
            _safeMint(_msgSender(), tokenIds[i]);
        }
    }

    /**
     * Allows the caller to burn tokens they own or have been approved to handle.
     * @param tokenIds the token IDs of the heroes that are to be burnt
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
