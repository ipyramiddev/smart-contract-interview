// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./lib/draft-EIP712.sol";
import "./lib/ERC721Enumerable.sol";
import "./lib/Ownable.sol";
import "./lib/Pausable.sol";

contract Porble is ERC721Enumerable, EIP712, Ownable, Pausable {
    // The expected signer of the signature required for minting
    address private _mintSigner;

    constructor(address signer)
        ERC721("Porble", "PRBL")
        EIP712("PortalFantasy", "1")
    {
        _mintSigner = signer;
    }

    // @TODO: Have added a placeholder baseURI. Need to replace with actual when it's implemented.
    /**
     * Overriding the parent _baseURI() with required baseURI
     */
    function _baseURI() internal view virtual override returns (string memory) {
        return "https://www.portalfantasy.io/";
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
            signer == _mintSigner,
            "PorbleMintConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        _safeMint(_msgSender(), tokenId);
    }

    /**
     * Set the address of the signer which can sign messages specifying the mint conditions
     * @param signer the address of the signer to point to
     */
    function setMintSigner(address signer) external onlyOwner {
        _mintSigner = signer;
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
