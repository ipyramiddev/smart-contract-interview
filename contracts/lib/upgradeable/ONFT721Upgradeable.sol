// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./IERC165Upgradeable.sol";
import "./ONFT721CoreUpgradeable.sol";
import "./IONFT721Upgradeable.sol";
import "./ERC721RoyaltyUpgradeable.sol";

contract ONFT721Upgradeable is
    Initializable,
    ONFT721CoreUpgradeable,
    IONFT721Upgradeable,
    ERC721RoyaltyUpgradeable
{
    function __ONFT721Upgradeable_init(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint
    ) internal onlyInitializing {
        __ONFT721CoreUpgradeable_init_unchained(_lzEndpoint);
        __ERC721Royalty_init(_name, _symbol);
    }

    function __ONFT721Upgradeable_init_unchained(
        string memory _name,
        string memory _symbol,
        address _lzEndpoint
    ) internal onlyInitializing {}

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(
            ONFT721CoreUpgradeable,
            IERC165Upgradeable,
            ERC721RoyaltyUpgradeable
        )
        returns (bool)
    {
        return
            interfaceId == type(IONFT721Upgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _debitFrom(
        address _from,
        uint16,
        bytes memory,
        uint256 _tokenId
    ) internal virtual override {
        // "ONFT721:1" -> "ONFT721: send caller is not owner nor approved"
        require(_isApprovedOrOwner(_msgSender(), _tokenId), "ONFT721:1");
        // "ONFT721:2" -> "ONFT721: send from incorrect owner"
        require(ERC721Upgradeable.ownerOf(_tokenId) == _from, "ONFT721:2");
        _transfer(_from, address(this), _tokenId);
    }

    function _creditTo(
        uint16,
        address _toAddress,
        uint256 _tokenId
    ) internal virtual override {
        require(
            !_exists(_tokenId) ||
                (_exists(_tokenId) &&
                    ERC721Upgradeable.ownerOf(_tokenId) == address(this))
        );
        if (!_exists(_tokenId)) {
            _safeMint(_toAddress, _tokenId);
        } else {
            _transfer(address(this), _toAddress, _tokenId);
        }
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
