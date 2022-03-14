import bigInt from "big-integer";

export const getTxIdFromMultiSigWallet = async (multiSigWalletContract: any) => {
    const txCount = await multiSigWalletContract.methods.getTransactionCount(true, true).call();
    const txId = bigInt(txCount).subtract("1").toString();
    return txId;
};
