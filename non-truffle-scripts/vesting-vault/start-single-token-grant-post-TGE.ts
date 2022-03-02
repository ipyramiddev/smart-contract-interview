// @NOTE: KEEP THE PROD KEY IMPORT COMMENTED OUT BY DEFAULT TO SAFEGUARD AGAINST ACCIDENTAL SCRIPT RUNS
// import masterKeys from "../prod-master-keys";
import masterKeys from "../../test-master-keys";

import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { TransactionConfig } from "web3-core";
import { config } from "../../config";
import VESTING_VAULT_JSON from "../../build/contracts/VestingVault.json";

// @NOTE: Remember to add any new token grants to the global map

const ADMIN_ADDRESS = masterKeys.admin.address;

// Contract info
const VESTING_VAULT_ABI = VESTING_VAULT_JSON.abi as AbiItem[];

// @TODO: When VESTING_VAULT_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const VESTING_VAULT_ADDRESS = "0x930EB1088140cdA7D0948544FBe6D44414Fa6331";

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const VestingVaultInstance = new web3.eth.Contract(VESTING_VAULT_ABI, VESTING_VAULT_ADDRESS);

web3.eth.handleRevert = true;

// Details of recipient's grant to add
const RECIPIENT_ADDRESS = "0x7ae9d22946f3fd429d7ac9d31b76025b6556c1c9";
const VESTING_CATEGORY = "SEED";
const ALLOCATION = 3000000;
const VESTING_DURATION_IN_MONTHS = 12;
const CLIFF_IN_MONTHS = 6;

async function main() {
    console.log(`\nAttempting to add a grant for recipient: ${RECIPIENT_ADDRESS}`);
    console.log(`Category: ${VESTING_CATEGORY}`);
    console.log(`Allocation: ${ALLOCATION} tokens`);
    console.log(`Cliff: ${CLIFF_IN_MONTHS} months`);
    console.log(`Linear vesting duration: ${VESTING_DURATION_IN_MONTHS} months\n`);

    try {
        const data = VestingVaultInstance.methods.addTokenGrant(RECIPIENT_ADDRESS, ALLOCATION, VESTING_DURATION_IN_MONTHS, CLIFF_IN_MONTHS).encodeABI();

        const txData: TransactionConfig = {
            from: ADMIN_ADDRESS,
            to: VESTING_VAULT_ADDRESS,
            gas: "1000000",
            gasPrice: web3.utils.toWei("80", "gwei"),
            data,
        };

        const signedTxData = await web3.eth.accounts.signTransaction(txData, masterKeys.admin.privateKey);
        const result = await web3.eth.sendSignedTransaction(signedTxData.rawTransaction!);

        console.log(`${JSON.stringify(result)}\n`);
        console.log(`Grant created for the recipent: ${RECIPIENT_ADDRESS}\n`);
    } catch (err) {
        console.log(err);
    }
}

main();
