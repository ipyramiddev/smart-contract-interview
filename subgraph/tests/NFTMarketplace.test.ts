import { assert, describe, test, clearStore, afterEach } from 'matchstick-as/assembly/index';
import { Address, BigInt } from '@graphprotocol/graph-ts';
import { handleItemListed, handleItemBought, handleItemCancelled } from '../src/NFTMarketplace';
import { createItemListedEvent, createItemBoughtEvent, createItemCancelledEvent } from './NFTMarketplace-utils';

const ZERO_ADDRESS: string = '0x0000000000000000000000000000000000000000';
const ACCOUNT_1_ADDRESS: string = '0x7Ae9d22946F3Fd429D7aC9d31B76025B6556c1C9';
const ACCOUNT_2_ADDRESS: string = '0x769Fd6CC56E084119Dd7669ddb9A9F37D5827Db2';
const ACCOUNT_3_ADDRESS: string = '0xB7A61e70D2c5C53BF5787f208D91fF89D886e68C';
const ACCOUNT_4_ADDRESS: string = '0xBC109315617Bf4d0BdDABe29f5315355f08544Cd';
const ACCOUNT_5_ADDRESS: string = '0xb2ea8a1467Db745B18800c812414438E4A31f8bb';

describe('NFTMarketplace.test.ts', () => {
    afterEach(() => {
        clearStore();
    });

    test('updates the relevant stores when a new listing is created', () => {
        // Create and send an ItemListed event
        let id = BigInt.fromString('1');
        let seller = Address.fromString(ACCOUNT_1_ADDRESS);
        let NFTAddress = Address.fromString(ACCOUNT_5_ADDRESS);
        let tokenId = BigInt.fromString('123');
        let price = BigInt.fromString('1000');
        let newItemListedEvent = createItemListedEvent(id, seller, NFTAddress, tokenId, price);
        handleItemListed(newItemListedEvent);

        assert.entityCount('NFTCollection', 1);

        assert.entityCount('User', 1);

        assert.entityCount('Listing', 1);
        assert.fieldEquals('Listing', '0x1', 'collection', ACCOUNT_5_ADDRESS.toLowerCase());
        assert.fieldEquals('Listing', '0x1', 'seller', ACCOUNT_1_ADDRESS.toLowerCase());
        assert.fieldEquals('Listing', '0x1', 'tokenId', tokenId.toHexString());
        assert.fieldEquals('Listing', '0x1', 'price', '1000');
        assert.fieldEquals('Listing', '0x1', 'status', 'ACTIVE');
    });

    test('updates the relevant stores for multiple created listings', () => {
        let id = BigInt.fromString('1');
        let seller = Address.fromString(ACCOUNT_1_ADDRESS);
        let NFTAddress = Address.fromString(ACCOUNT_5_ADDRESS);
        let tokenId = BigInt.fromString('123');
        let price = BigInt.fromString('1000');
        let newItemListedEvent = createItemListedEvent(id, seller, NFTAddress, tokenId, price);
        handleItemListed(newItemListedEvent);

        id = BigInt.fromString('2');
        seller = Address.fromString(ACCOUNT_2_ADDRESS);
        NFTAddress = Address.fromString(ACCOUNT_4_ADDRESS);
        tokenId = BigInt.fromString('456');
        price = BigInt.fromString('1000');
        newItemListedEvent = createItemListedEvent(id, seller, NFTAddress, tokenId, price);
        handleItemListed(newItemListedEvent);

        assert.entityCount('NFTCollection', 2);

        assert.entityCount('User', 2);

        assert.entityCount('Listing', 2);
        assert.fieldEquals('Listing', '0x2', 'collection', ACCOUNT_4_ADDRESS.toLowerCase());
        assert.fieldEquals('Listing', '0x2', 'seller', ACCOUNT_2_ADDRESS.toLowerCase());
        assert.fieldEquals('Listing', '0x2', 'tokenId', tokenId.toHexString());
        assert.fieldEquals('Listing', '0x2', 'price', '1000');
        assert.fieldEquals('Listing', '0x2', 'status', 'ACTIVE');
    });

    test('updates the relevant stores when a listing is cancelled', () => {
        let id = BigInt.fromString('1');
        let seller = Address.fromString(ACCOUNT_1_ADDRESS);
        let NFTAddress = Address.fromString(ACCOUNT_5_ADDRESS);
        let tokenId = BigInt.fromString('123');
        let price = BigInt.fromString('1000');
        let newItemListedEvent = createItemListedEvent(id, seller, NFTAddress, tokenId, price);
        handleItemListed(newItemListedEvent);
        let itemCancelledEvent = createItemCancelledEvent(id, seller, NFTAddress, tokenId);
        handleItemCancelled(itemCancelledEvent);

        assert.entityCount('NFTCollection', 1);

        assert.entityCount('User', 1);

        assert.entityCount('Listing', 1);
        assert.fieldEquals('Listing', '0x1', 'status', 'CANCELLED'); // The other fields are not available on this layer of this listing since only status and timestamps are updated as a result of this event
    });

    test('updates the an updated listing price correctly', () => {
        let id = BigInt.fromString('1');
        let seller = Address.fromString(ACCOUNT_1_ADDRESS);
        let NFTAddress = Address.fromString(ACCOUNT_5_ADDRESS);
        let tokenId = BigInt.fromString('123');
        let price = BigInt.fromString('1000');
        let itemListedEvent = createItemListedEvent(id, seller, NFTAddress, tokenId, price);
        let newPrice = BigInt.fromString('2000');
        handleItemListed(itemListedEvent);
        itemListedEvent = createItemListedEvent(id, seller, NFTAddress, tokenId, newPrice);
        handleItemListed(itemListedEvent);

        assert.entityCount('NFTCollection', 1);

        assert.entityCount('User', 1);

        assert.entityCount('Listing', 1);
        assert.fieldEquals('Listing', '0x1', 'collection', ACCOUNT_5_ADDRESS.toLowerCase());
        assert.fieldEquals('Listing', '0x1', 'seller', ACCOUNT_1_ADDRESS.toLowerCase());
        assert.fieldEquals('Listing', '0x1', 'tokenId', tokenId.toHexString());
        assert.fieldEquals('Listing', '0x1', 'price', '2000');
        assert.fieldEquals('Listing', '0x1', 'status', 'ACTIVE');
    });

    test('updates the relevant stores when a listed item is bought', () => {
        let id = BigInt.fromString('1');
        let seller = Address.fromString(ACCOUNT_1_ADDRESS);
        let buyer = Address.fromString(ACCOUNT_2_ADDRESS);
        let NFTAddress = Address.fromString(ACCOUNT_5_ADDRESS);
        let tokenId = BigInt.fromString('123');
        let price = BigInt.fromString('1000');
        let newItemListedEvent = createItemListedEvent(id, seller, NFTAddress, tokenId, price);
        handleItemListed(newItemListedEvent);
        let itemBoughtEvent = createItemBoughtEvent(id, buyer, NFTAddress, tokenId, price);
        handleItemBought(itemBoughtEvent);

        assert.entityCount('NFTCollection', 1);

        assert.entityCount('User', 2);

        assert.entityCount('Listing', 1);
        assert.fieldEquals('Listing', '0x1', 'buyer', ACCOUNT_2_ADDRESS.toLowerCase()); // The other fields are not available on this layer of this listing since only buyer, status and timestamps are updated as a result of this event
        assert.fieldEquals('Listing', '0x1', 'status', 'BOUGHT'); // The other fields are not available on this layer of this listing since only buyer, status and timestamps are updated as a result of this event
    });
});
