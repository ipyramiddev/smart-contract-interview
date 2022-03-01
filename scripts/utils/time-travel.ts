import { HttpProvider } from "web3-core";

export async function advanceTimeAndBlock(time: number) {
    await advanceTime(time);
    await advanceBlock();

    return Promise.resolve(web3.eth.getBlock("latest"));
}

export function advanceTime(time: number) {
    return new Promise((resolve, reject) => {
        (web3.currentProvider as HttpProvider).send(
            {
                jsonrpc: "2.0",
                method: "evm_increaseTime",
                params: [time],
                id: new Date().getTime(),
            },
            (err, result) => {
                if (err) {
                    return reject(err);
                }
                return resolve(result);
            }
        );
    });
}

export function advanceBlock() {
    return new Promise((resolve, reject) => {
        (web3.currentProvider as HttpProvider).send(
            {
                jsonrpc: "2.0",
                method: "evm_mine",
                id: new Date().getTime(),
                params: [],
            },
            async (err, result) => {
                if (err) {
                    return reject(err);
                }
                const newBlockHash = (await web3.eth.getBlock("latest")).hash;

                return resolve(newBlockHash);
            }
        );
    });
}

export async function getCurrentTime() {
    const block = await web3.eth.getBlock("latest");
    return block.timestamp;
}

async function advanceTimeAndBlockTo(timeSecs: number) {
    const currentTime = await getCurrentTime();

    if (currentTime > timeSecs) {
        console.warn(`advanceTimeAndBlockTo: Current time ${currentTime} is greater than target ${timeSecs}. This will probably do nothing.`);
    }

    return advanceTimeAndBlock(Math.max(timeSecs - Number(currentTime), 0));
}

module.exports = {
    advanceTime,
    advanceBlock,
    advanceTimeAndBlock,
    getCurrentTime,
    advanceTimeAndBlockTo,
};
