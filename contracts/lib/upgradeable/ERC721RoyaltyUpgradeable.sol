// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.5.0) (token/ERC721/extensions/ERC721Royalty.sol)

pragma solidity ^0.8.0;

import "./ERC721Upgradeable.sol";
import "./ERC2981Upgradeable.sol";
import "./ERC165Upgradeable.sol";
import "./Initializable.sol";

abstract contract ERC721RoyaltyUpgradeable is
    Initializable,
    ERC2981Upgradeable,
    ERC721Upgradeable
{
    function __ERC721Royalty_init(string memory _name, string memory _symbol)
        internal
        onlyInitializing
    {
        __ERC721_init(_name, _symbol);
    }

    function __ERC721Royalty_init_unchained() internal onlyInitializing {}

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721Upgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev See {ERC721-_burn}. This override additionally clears the royalty information for the token.
     */
    function _burn(uint256 tokenId) internal virtual override {
        super._burn(tokenId);
        _resetTokenRoyalty(tokenId);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
