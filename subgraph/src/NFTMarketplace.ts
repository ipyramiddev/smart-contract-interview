import { ItemListed, ItemCancelled, ItemBought } from '../generated/NFTMarketplace/NFTMarketplace';
import { fetchPartialUser, fetchListing, fetchPartialNFTCollection, fetchPartialListing } from './helpers';

export function handleItemListed(event: ItemListed): void {
    const NFTCollection = fetchPartialNFTCollection(event.params.NFTAddress.toHexString());
    const seller = fetchPartialUser(event.params.seller.toHexString());
    const listing = fetchListing(event.params.id.toHexString());
    listing.seller = seller.id;
    listing.collection = NFTCollection.id;
    listing.tokenId = event.params.tokenId.toHexString();
    listing.price = event.params.price;
    listing.status = 'ACTIVE';
    listing.lastStatusTimestamp = event.block.timestamp;
    listing.save();
}

export function handleItemBought(event: ItemBought): void {
    const listing = fetchPartialListing(event.params.id.toHexString());
    const buyer = fetchPartialUser(event.params.buyer.toHexString());
    listing.buyer = buyer.id;
    listing.status = 'BOUGHT';
    listing.lastStatusTimestamp = event.block.timestamp;
    listing.save();
}

export function handleItemCancelled(event: ItemCancelled): void {
    const listing = fetchPartialListing(event.params.id.toHexString());
    listing.status = 'CANCELLED';
    listing.lastStatusTimestamp = event.block.timestamp;
    listing.save();
}
