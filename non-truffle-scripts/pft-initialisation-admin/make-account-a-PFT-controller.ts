// @NOTE: KEEP THE PROD KEY IMPORT COMMENTED OUT BY DEFAULT TO SAFEGUARD AGAINST ACCIDENTAL SCRIPT RUNS
// import masterKeys from "../prod-master-keys";
import masterKeys from "../../test-master-keys";

import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { TransactionConfig } from "web3-core";
import { config } from "../../config";
import PFT_JSON from "../../build/contracts/PFT.json";

// Contract info
const PFT_ABI = PFT_JSON.abi as AbiItem[];

// @TODO: When PFT_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const PFT_ADDRESS = "0xE8B0D194478E6fC1C68D6aD1C32BaEb7637F3Eb1";
const CONTROLLER_ACCOUNT = masterKeys.admin.address;

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const PFTInstance = new web3.eth.Contract(PFT_ABI, PFT_ADDRESS);

web3.eth.handleRevert = true;

async function main() {
    try {
        const data = PFTInstance.methods.addController(CONTROLLER_ACCOUNT).encodeABI();

        const txData: TransactionConfig = {
            from: masterKeys.admin.address,
            to: PFT_ADDRESS,
            gas: "1000000",
            gasPrice: web3.utils.toWei("80", "gwei"),
            data,
        };

        const signedTxData = await web3.eth.accounts.signTransaction(txData, masterKeys.admin.privateKey);
        const result = await web3.eth.sendSignedTransaction(signedTxData.rawTransaction!);

        console.log(`${JSON.stringify(result)}\n`);
        console.log(`Account: ${CONTROLLER_ACCOUNT} is now a controller of the PFT contract`);
    } catch (err) {
        console.log(err);
    }
}

main();
