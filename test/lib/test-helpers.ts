import { bigInt } from "./test-libraries";
import { MultiSigWalletInstance } from "../../types/truffle-contracts";

export const getTxIdFromMultiSigWallet = async (multiSigWalletInstance: MultiSigWalletInstance) => {
    const txCount = (await multiSigWalletInstance.getTransactionCount(true, true)).toString();
    const txId = bigInt(txCount).subtract("1").toString();
    return txId;
};
