import { BigInt } from '@graphprotocol/graph-ts';
import { PorbleStat, Porble, User } from '../generated/schema';

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Note: If a handler doesn't require existing field values, it is faster
// not to load the entity from the store. Instead, create it fresh with
// `new Entity(...)`, set the fields that should be updated and save the
// entity back to the store. Fields that were not set or unset remain
// unchanged, allowing for partial updates to be applied. The set of functions
// fetchPartial<ENTITY_NAME>() have been created for this purpose

export function fetchPorble(id: string): Porble {
    let porble = Porble.load(id);

    if (!porble) {
        porble = new Porble(id);
        porble.owner = ZERO_ADDRESS;
        porble.mintedAt = BigInt.fromI32(0);

        porble.save();
    }

    return <Porble>porble;
}

export function fetchPartialPorble(id: string): Porble {
    const porble = new Porble(id);
    porble.save();
    return <Porble>porble;
}

export function fetchPorbleStat(id: string): PorbleStat {
    let porbleStat = PorbleStat.load(id);

    if (!porbleStat) {
        porbleStat = new PorbleStat(id);
        porbleStat.count = BigInt.fromI32(0);
        porbleStat.save();
    }

    return <PorbleStat>porbleStat;
}

export function fetchPartialPorbleStat(id: string): PorbleStat {
    const porbleStat = new PorbleStat(id);
    porbleStat.save();
    return <PorbleStat>porbleStat;
}

export function fetchUser(id: string): User {
    let user = User.load(id);

    if (!user) {
        user = new User(id);
        user.save();
    }

    return <User>user;
}

export function fetchPartialUser(id: string): User {
    const user = new User(id);
    user.save();
    return <User>user;
}
