import { assert, describe, test, clearStore, afterEach, beforeEach } from 'matchstick-as/assembly/index';
import { Address, BigInt } from '@graphprotocol/graph-ts';
import { handlePorbleTransfer } from '../src/porble';
import { createTransferEvent } from './utils';

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

// For more test scenarios, see:
// https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

// More assert options:
// https://thegraph.com/docs/en/developer/matchstick/#asserts

const ZERO_ADDRESS: string = '0x0000000000000000000000000000000000000000';
const ACCOUNT_1_ADDRESS: string = '0x7Ae9d22946F3Fd429D7aC9d31B76025B6556c1C9';
const ACCOUNT_2_ADDRESS: string = '0x769Fd6CC56E084119Dd7669ddb9A9F37D5827Db2';
const ACCOUNT_3_ADDRESS: string = '0xB7A61e70D2c5C53BF5787f208D91fF89D886e68C';
const ACCOUNT_4_ADDRESS: string = '0xBC109315617Bf4d0BdDABe29f5315355f08544Cd';
const ACCOUNT_5_ADDRESS: string = '0xb2ea8a1467Db745B18800c812414438E4A31f8bb';

describe('porble.test.ts', () => {
    beforeEach(() => {
        let sender = Address.fromString(ZERO_ADDRESS);
        let recipient = Address.fromString(ACCOUNT_1_ADDRESS);
        let tokenId = BigInt.fromString('1');
        let newTransferEvent = createTransferEvent(sender, recipient, tokenId);
        handlePorbleTransfer(newTransferEvent);
    });

    afterEach(() => {
        clearStore();
    });

    test('updates the user store when a porble is minted to their address, incrementing the porble stats counter', () => {
        assert.entityCount('Porble', 1);
        assert.fieldEquals('Porble', '0x1', 'owner', ACCOUNT_1_ADDRESS.toLowerCase());

        assert.entityCount('PorbleStat', 1);
        assert.fieldEquals('PorbleStat', 'global', 'count', '1');
    });

    test('processes a porble burn by sending it to the zero address and decrementing the stats counter', () => {
        // Create and send a transfer event corresponding to burning a porble
        let sender = Address.fromString(ACCOUNT_1_ADDRESS);
        let recipient = Address.fromString(ZERO_ADDRESS);
        let tokenId = BigInt.fromString('1');
        let newTransferEvent = createTransferEvent(sender, recipient, tokenId);
        handlePorbleTransfer(newTransferEvent);

        assert.entityCount('Porble', 1);
        assert.fieldEquals('Porble', '0x1', 'owner', ZERO_ADDRESS);

        assert.entityCount('PorbleStat', 1);
        assert.fieldEquals('PorbleStat', 'global', 'count', '0');
    });

    test('processes a porble transfer to a new address and doesn`t change the stats counter', () => {
        // Create and send a transfer event corresponding transferring the porble to a new, non-zero address
        let sender = Address.fromString(ACCOUNT_1_ADDRESS);
        let recipient = Address.fromString(ACCOUNT_2_ADDRESS);
        let tokenId = BigInt.fromString('1');
        let newTransferEvent = createTransferEvent(sender, recipient, tokenId);
        handlePorbleTransfer(newTransferEvent);

        assert.entityCount('Porble', 1);
        assert.fieldEquals('Porble', '0x1', 'owner', ACCOUNT_2_ADDRESS.toLowerCase());

        assert.entityCount('PorbleStat', 1);
        assert.fieldEquals('PorbleStat', 'global', 'count', '1');
    });

    test('increments the stats counter for every porble minted', () => {
        // Create and send a transfer event corresponding transferring the porble to a new, non-zero address
        let sender = Address.fromString(ZERO_ADDRESS);
        let recipient = Address.fromString(ACCOUNT_2_ADDRESS);
        let tokenId = BigInt.fromString('20');
        let newTransferEvent = createTransferEvent(sender, recipient, tokenId);
        handlePorbleTransfer(newTransferEvent);

        recipient = Address.fromString(ACCOUNT_3_ADDRESS);
        tokenId = BigInt.fromString('300');
        newTransferEvent = createTransferEvent(sender, recipient, tokenId);
        handlePorbleTransfer(newTransferEvent);

        recipient = Address.fromString(ACCOUNT_4_ADDRESS);
        tokenId = BigInt.fromString('4000');
        newTransferEvent = createTransferEvent(sender, recipient, tokenId);
        handlePorbleTransfer(newTransferEvent);

        recipient = Address.fromString(ACCOUNT_5_ADDRESS);
        tokenId = BigInt.fromString('50000');
        newTransferEvent = createTransferEvent(sender, recipient, tokenId);
        handlePorbleTransfer(newTransferEvent);

        assert.entityCount('Porble', 5);

        assert.entityCount('PorbleStat', 1);
        assert.fieldEquals('PorbleStat', 'global', 'count', '5');
    });
});
