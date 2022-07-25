import { newMockEvent } from 'matchstick-as';
import { ethereum, Address, BigInt } from '@graphprotocol/graph-ts';
import { Transfer } from '../generated/Porble/Porble';

export function createTransferEvent(from: Address, to: Address, tokenId: BigInt): Transfer {
    let transferEvent = changetype<Transfer>(newMockEvent());

    transferEvent.parameters = new Array();

    transferEvent.parameters.push(new ethereum.EventParam('from', ethereum.Value.fromAddress(from)));
    transferEvent.parameters.push(new ethereum.EventParam('to', ethereum.Value.fromAddress(to)));
    transferEvent.parameters.push(new ethereum.EventParam('tokenId', ethereum.Value.fromUnsignedBigInt(tokenId)));

    return transferEvent;
}
