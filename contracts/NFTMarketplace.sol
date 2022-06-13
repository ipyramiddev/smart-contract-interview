// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./lib/Ownable.sol";
import "./lib/IERC721.sol";
import "./lib/IERC2981.sol";
import "./lib/ReentrancyGuard.sol";

contract NFTMarketplace is ReentrancyGuard, Ownable {
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
        IERC721 NFT = IERC721(NFTAddress);
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

    mapping(address => mapping(uint256 => Listing)) private listings;

    // Proceeds are stored within the contract for later withdrawal by the seller
    // This is safer than pushing the proceeds directly within the buyItem function
    mapping(address => uint256) private earnedProceeds;

    // NFT contracts must be whitelisted before its tokens can be listed
    mapping(address => bool) collectionsWhitelist;

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
            IERC721(NFTAddress).getApproved(tokenId) == address(this),
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
        payable
        isListed(NFTAddress, tokenId)
        isCollectionWhitelisted(NFTAddress)
        nonReentrant
    {
        uint256 amountPaid = msg.value;
        Listing memory listedItem = listings[NFTAddress][tokenId];
        require(amountPaid == listedItem.price, "Price not met");
        (address royaltyReceiver, uint256 royaltyAmount) = IERC2981(NFTAddress)
            .royaltyInfo(tokenId, amountPaid);
        uint256 amountPaidToSeller = amountPaid - royaltyAmount;
        earnedProceeds[royaltyReceiver] += royaltyAmount;
        earnedProceeds[listedItem.seller] += amountPaidToSeller;
        delete (listings[NFTAddress][tokenId]);
        IERC721(NFTAddress).safeTransferFrom(
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

    function withdrawProceeds() external {
        uint256 proceeds = earnedProceeds[msg.sender];
        require(proceeds > 0, "No proceeds");
        earnedProceeds[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        require(success, "Transfer failed");
    }

    function getListing(address NFTAddress, uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return listings[NFTAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return earnedProceeds[seller];
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
}
