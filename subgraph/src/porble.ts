import { BigInt, Address } from '@graphprotocol/graph-ts';
import { Transfer } from '../generated/Porble/Porble';
import { fetchPorbleStat, fetchPartialUser, fetchPartialPorble, ZERO_ADDRESS } from './helpers';

// It is also possible to access smart contracts from mappings. For
// example, the contract that has emitted the event can be connected to
// with:
//
// let contract = Contract.bind(event.address)
//
// The following functions can then be called on this contract to access
// state variables and other data:
//
// - contract.admin(...)
// - contract.implementation(...)

export function handlePorbleTransfer(event: Transfer): void {
    const user = fetchPartialUser(event.params.to.toHexString());

    const porble = fetchPartialPorble(event.params.tokenId.toHexString());
    porble.owner = user.id;

    // Token mint
    if (event.params.from.equals(Address.fromString(ZERO_ADDRESS))) {
        porble.mintedAt = event.block.timestamp;

        const porbleStat = fetchPorbleStat('global');
        porbleStat.count = porbleStat.count.plus(BigInt.fromI32(1));
        porbleStat.save();
    }

    // Token burn
    if (event.params.to.equals(Address.fromString(ZERO_ADDRESS))) {
        const porbleStat = fetchPorbleStat('global');
        porbleStat.count = porbleStat.count.minus(BigInt.fromI32(1));
        porbleStat.save();
    }

    porble.save();
}
