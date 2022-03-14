// This is a general script for confirming any tx (with a valid txId) for a multisig
// Use ts-node to run

// @NOTE: KEEP THE PROD KEY IMPORT COMMENTED OUT BY DEFAULT TO SAFEGUARD AGAINST ACCIDENTAL SCRIPT RUNS
// import masterKeys from "../prod-master-keys";
import masterKeys from "../test-master-keys";

import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { config } from "../config";
import MULTI_SIG_WALLET_JSON from "../build/contracts/MultiSigWallet.json";

// Contract info
const MULTI_SIG_WALLET_ABI = MULTI_SIG_WALLET_JSON.abi as AbiItem[];

// @TODO: When MULTI_SIG_WALLET_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const MULTI_SIG_WALLET_ADDRESS = "0x52C84043CD9c865236f11d9Fc9F56aa003c1f922";

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const multiSigWalletInstance = new web3.eth.Contract(MULTI_SIG_WALLET_ABI, MULTI_SIG_WALLET_ADDRESS);

web3.eth.handleRevert = true;

const txIdToCheck = "9";

async function main() {
    try {
        const info = await multiSigWalletInstance.methods.transactions(txIdToCheck).call();
        console.log(`executed=${info.executed}`);
    } catch (err) {
        console.log(err);
    }
}

main();
