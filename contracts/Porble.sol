// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./lib/draft-EIP712.sol";
import "./lib/ERC721Royalty.sol";
import "./lib/ContractURIStorage.sol";
import "./lib/Ownable.sol";
import "./lib/Pausable.sol";

contract Porble is
    ERC721Royalty,
    ContractURIStorage,
    EIP712,
    Ownable,
    Pausable
{
    string public baseURIString;

    // Some marketplaces use this for collection metadata and royalties
    string public contractURIString;

    // The expected signer of the signature required for minting
    address public mintSigner;

    constructor(address signer)
        ERC721("Portal Fantasy Porble", "PRBL")
        EIP712("PortalFantasy", "1")
    {
        // @TODO: Have added a placeholder baseURIString. Need to replace with actual when it's implemented.
        baseURIString = "https://www.portalfantasy.io/";
        // @TODO: Have added a placeholder contractURIString. Need to replace with actual when it's implemented.
        contractURIString = "https://www.portalfantasy.io/porble/";
        mintSigner = signer;
    }

    /**
     * Overriding the parent _baseURI() with required baseURI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return baseURIString;
    }

    /**
     * Allows the caller to mint a token with specified tokenId if the signature is valid
     * The recipient and the tokenId to be minted is determined by the signer
     * @param signature the signed message specifying the recipient and tokenId to mint and transfer
     * @param tokenId the tokenId to mint and transfer to the caller
     */
    function safeMint(bytes calldata signature, uint256 tokenId) external {
        // Only allow the caller to mint if the signature is valid
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    keccak256(
                        "PorbleMintConditions(address minter,uint256 tokenId)"
                    ),
                    _msgSender(),
                    tokenId
                )
            )
        );

        address signer = ECDSA.recover(digest, signature);

        require(
            signer == mintSigner,
            "PorbleMintConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        _safeMint(_msgSender(), tokenId);
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
     * Enable the owner to pause / unpause minting
     * @param _paused paused when set to `true`, unpause when set to `false`
     */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }
}
