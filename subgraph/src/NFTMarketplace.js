import { Item, BoughtItem } from "../generated/schema";

export function handleItemListed(event: ItemListed): void {
    let tokenId: string = event.params.tokenId.toString();
    
    let Item: Item = new Item(tokenId);
    // Create the Item entity.
    Item.NFTAddress = event.params.NFTAddress.toHex();
    Item.price = event.params.price;
    Item.seller = event.params.seller;
    Item.status = "listed";
    Item.created = event.params.created;
    Item.save();
}

export function handleItemBought(event: ItemBought) {
    let tokenID: String = event.params.tokenID.toString();
    // Load the Item entity.
    let Item = Item.load(tokenID);
    // Update the Item entity.
    Item.status = "Bought";
    Item.seller = event.params.seller;
    Item.save();

    // Create BoughtItem entity.
    let boughtItem = new BoughtItem(tokenId);
    boughtItem.price = event.params.price;
    boughtItem.NFTAddress = event.params.NFTAddress.toHex();
    boughtItem.seller = event.params.seller;
    boughtItem.buyer = event.params.buyer;
    boughtItem.boughtCreated = event.params.created;
    boughtItem.save();
}

export function handleItemCancelled(event: ItemCancelled) {
    
}
