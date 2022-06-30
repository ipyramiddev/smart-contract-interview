// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../lib/upgradeable/OwnableUpgradeable.sol";
import "../lib/upgradeable/IERC20Upgradeable.sol";
import "../lib/upgradeable/IERC721Upgradeable.sol";
import "../lib/upgradeable/IERC2981Upgradeable.sol";
import "../lib/upgradeable/ReentrancyGuardUpgradeable.sol";

// @NOTE: Remove getListing function to test the contract upgrade

contract NFTMarketplaceUpgradeableTest is
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    // Structs
    struct Listing {
        uint256 price;
        address seller;
    }

    // Events
    event ItemListed(
        address indexed seller,
        address indexed NFTAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    event ItemCancelled(
        address indexed seller,
        address indexed NFTAddress,
        uint256 indexed tokenId
    );

    event ItemBought(
        address indexed buyer,
        address indexed NFTAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    // Modifiers
    modifier notListed(
        address NFTAddress,
        uint256 tokenId,
        address owner
    ) {
        Listing memory listing = listings[NFTAddress][tokenId];
        require(listing.price == 0, "Already listed");
        _;
    }

    modifier isNFTOwner(
        address NFTAddress,
        uint256 tokenId,
        address spender
    ) {
        IERC721Upgradeable NFT = IERC721Upgradeable(NFTAddress);
        address owner = NFT.ownerOf(tokenId);
        require(spender == owner, "Not owner");
        _;
    }

    modifier isListed(address NFTAddress, uint256 tokenId) {
        Listing memory listing = listings[NFTAddress][tokenId];
        require(listing.price > 0, "Not listed");
        _;
    }

    modifier isCollectionWhitelisted(address NFTAddress) {
        require(
            collectionsWhitelist[NFTAddress],
            "Collection not whitelisted on marketplace"
        );
        _;
    }

    address WAVAXAddress;

    mapping(address => mapping(uint256 => Listing)) private listings;

    // NFT contracts must be whitelisted before its tokens can be listed
    mapping(address => bool) collectionsWhitelist;

    function initialize(address _WAVAXAddress) public initializer {
        __ReentrancyGuard_init();
        __Ownable_init();
        WAVAXAddress = _WAVAXAddress;
    }

    function updateCollectionsWhitelist(address NFTAddress, bool allowed)
        external
        onlyOwner
    {
        collectionsWhitelist[NFTAddress] = allowed;
    }

    function listItem(
        address NFTAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        notListed(NFTAddress, tokenId, msg.sender)
        isNFTOwner(NFTAddress, tokenId, msg.sender)
        isCollectionWhitelisted(NFTAddress)
    {
        require(price > 0, "Price must be above zero");
        require(
            IERC721Upgradeable(NFTAddress).getApproved(tokenId) ==
                address(this),
            "Not approved for marketplace"
        );
        listings[NFTAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, NFTAddress, tokenId, price);
    }

    function cancelListing(address NFTAddress, uint256 tokenId)
        external
        isNFTOwner(NFTAddress, tokenId, msg.sender)
        isListed(NFTAddress, tokenId)
    {
        delete (listings[NFTAddress][tokenId]);
        emit ItemCancelled(msg.sender, NFTAddress, tokenId);
    }

    function buyItem(address NFTAddress, uint256 tokenId)
        external
        isListed(NFTAddress, tokenId)
        isCollectionWhitelisted(NFTAddress)
        nonReentrant
    {
        Listing memory listedItem = listings[NFTAddress][tokenId];

        (address royaltyReceiver, uint256 royaltyAmount) = IERC2981Upgradeable(
            NFTAddress
        ).royaltyInfo(tokenId, listedItem.price);

        uint256 amountPaidToSeller = listedItem.price - royaltyAmount;

        // Pay the royalty fee and the rest to the seller
        IERC20Upgradeable(WAVAXAddress).transferFrom(
            msg.sender,
            royaltyReceiver,
            royaltyAmount
        );
        IERC20Upgradeable(WAVAXAddress).transferFrom(
            msg.sender,
            listedItem.seller,
            amountPaidToSeller
        );
        delete (listings[NFTAddress][tokenId]);
        IERC721Upgradeable(NFTAddress).safeTransferFrom(
            listedItem.seller,
            msg.sender,
            tokenId
        );
        emit ItemBought(msg.sender, NFTAddress, tokenId, listedItem.price);
    }

    function updateListing(
        address NFTAddress,
        uint256 tokenId,
        uint256 newPrice
    )
        external
        isListed(NFTAddress, tokenId)
        isCollectionWhitelisted(NFTAddress)
        nonReentrant
        isNFTOwner(NFTAddress, tokenId, msg.sender)
    {
        require(newPrice > 0, "Price must be above zero");
        listings[NFTAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, NFTAddress, tokenId, newPrice);
    }

    // Admin functions
    function forceCancelListing(address NFTAddress, uint256 tokenId)
        external
        onlyOwner
        isListed(NFTAddress, tokenId)
    {
        delete (listings[NFTAddress][tokenId]);
        emit ItemCancelled(msg.sender, NFTAddress, tokenId);
    }

    function getListing(address NFTAddress, uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return listings[NFTAddress][tokenId];
    }
}