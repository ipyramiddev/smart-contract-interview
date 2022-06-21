export function attachListeners(trxPromise) {
    trxPromise
        .once('transactionHash', function (hash) {
            console.log(`TX hash: ${hash}`);
        })
        .once('error', function (error, receipt) {
            console.error(`Got an error: ${error.reason || error.message}`);
        });

    return trxPromise;
}
