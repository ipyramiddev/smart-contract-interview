// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./lib/draft-EIP712.sol";
import "./lib/ERC721Enumerable.sol";
import "./lib/Ownable.sol";
import "./lib/Pausable.sol";

contract Porble is ERC721Enumerable, EIP712, Ownable, Pausable {
    // The expected signer of the signature required for minting
    address private _mintApprover;

    constructor(address _approver)
        ERC721("Porble", "PRBL")
        EIP712("PortalFantasy", "1")
    {
        _mintApprover = _approver;
    }

    // @TODO: Have added a placeholder baseURI. Need to replace with actual when it's implemented.
    function _baseURI() internal view virtual override returns (string memory) {
        return "https://www.portalfantasy.io/";
    }

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
            signer == _mintApprover,
            "PorbleMintConditions: invalid signature"
        );
        require(signer != address(0), "ECDSA: invalid signature");

        _safeMint(_msgSender(), tokenId);
    }

    function setMintApprover(address _approver) external onlyOwner {
        _mintApprover = _approver;
    }

    // Enable the owner to pause / unpause minting
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) _pause();
        else _unpause();
    }
}
