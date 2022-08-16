import { newMockEvent } from 'matchstick-as';
import { ethereum, Address, BigInt } from '@graphprotocol/graph-ts';
import { ItemListed, ItemBought, ItemCancelled } from '../generated/NFTMarketplace/NFTMarketplace';

export function createItemListedEvent(id: BigInt, seller: Address, NFTAddress: Address, tokenId: BigInt, price: BigInt): ItemListed {
    let itemListedEvent = changetype<ItemListed>(newMockEvent());

    itemListedEvent.parameters = new Array();

    itemListedEvent.parameters.push(new ethereum.EventParam('id', ethereum.Value.fromUnsignedBigInt(id)));
    itemListedEvent.parameters.push(new ethereum.EventParam('seller', ethereum.Value.fromAddress(seller)));
    itemListedEvent.parameters.push(new ethereum.EventParam('NFTAddress', ethereum.Value.fromAddress(NFTAddress)));
    itemListedEvent.parameters.push(new ethereum.EventParam('tokenId', ethereum.Value.fromUnsignedBigInt(tokenId)));
    itemListedEvent.parameters.push(new ethereum.EventParam('price', ethereum.Value.fromUnsignedBigInt(price)));

    return itemListedEvent;
}

export function createItemBoughtEvent(id: BigInt, buyer: Address, NFTAddress: Address, tokenId: BigInt, price: BigInt): ItemBought {
    let itemBoughtEvent = changetype<ItemBought>(newMockEvent());

    itemBoughtEvent.parameters = new Array();

    itemBoughtEvent.parameters.push(new ethereum.EventParam('id', ethereum.Value.fromUnsignedBigInt(id)));
    itemBoughtEvent.parameters.push(new ethereum.EventParam('buyer', ethereum.Value.fromAddress(buyer)));
    itemBoughtEvent.parameters.push(new ethereum.EventParam('NFTAddress', ethereum.Value.fromAddress(NFTAddress)));
    itemBoughtEvent.parameters.push(new ethereum.EventParam('tokenId', ethereum.Value.fromUnsignedBigInt(tokenId)));
    itemBoughtEvent.parameters.push(new ethereum.EventParam('price', ethereum.Value.fromUnsignedBigInt(price)));

    return itemBoughtEvent;
}

export function createItemCancelledEvent(id: BigInt, seller: Address, NFTAddress: Address, tokenId: BigInt): ItemCancelled {
    let itemCancelledEvent = changetype<ItemCancelled>(newMockEvent());

    itemCancelledEvent.parameters = new Array();

    itemCancelledEvent.parameters.push(new ethereum.EventParam('id', ethereum.Value.fromUnsignedBigInt(id)));
    itemCancelledEvent.parameters.push(new ethereum.EventParam('seller', ethereum.Value.fromAddress(seller)));
    itemCancelledEvent.parameters.push(new ethereum.EventParam('NFTAddress', ethereum.Value.fromAddress(NFTAddress)));
    itemCancelledEvent.parameters.push(new ethereum.EventParam('tokenId', ethereum.Value.fromUnsignedBigInt(tokenId)));

    return itemCancelledEvent;
}
