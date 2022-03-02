// @NOTE: This is one-time-use script to start the the INITIAL grants
// If further grants need to be created after running this, then we should use the file `start-single-token-grant-post-TGE.ts`

// @NOTE: KEEP THE PROD KEY IMPORT COMMENTED OUT BY DEFAULT TO SAFEGUARD AGAINST ACCIDENTAL SCRIPT RUNS
// import masterKeys from "../prod-master-keys";
import masterKeys from "../../test-master-keys";

import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { TransactionConfig } from "web3-core";
import { config } from "../../config";
import VESTING_VAULT_JSON from "../../build/contracts/VestingVault.json";
import { globalTokenGrants, categoryToVestingParameters } from "./data/token-grants";

const ADMIN_ADDRESS = masterKeys.admin.address;

// Contract info
const VESTING_VAULT_ABI = VESTING_VAULT_JSON.abi as AbiItem[];

// @TODO: When VESTING_VAULT_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const VESTING_VAULT_ADDRESS = "0x8Cd0eB872d0CE547013F0e02203CF92De0624b90";

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const VestingVaultInstance = new web3.eth.Contract(VESTING_VAULT_ABI, VESTING_VAULT_ADDRESS);

web3.eth.handleRevert = true;

async function main() {
    for (const [address, { allocation, category }] of globalTokenGrants.entries()) {
        const { cliffInMonths, vestingDurationInMonths } = categoryToVestingParameters.get(category)!;

        console.log(`\nAttempting to add a grant for recipient: ${address}`);
        console.log(`Category: ${category}`);
        console.log(`Allocation: ${allocation} tokens`);
        console.log(`Cliff: ${cliffInMonths} months`);
        console.log(`Linear vesting duration: ${vestingDurationInMonths} months\n`);

        try {
            const data = VestingVaultInstance.methods.addTokenGrant(address, allocation, vestingDurationInMonths, cliffInMonths).encodeABI();

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
            console.log(`Grant created for the recipient: ${address}\n`);
        } catch (err) {
            console.log(err);
        }
    }
}

main();
