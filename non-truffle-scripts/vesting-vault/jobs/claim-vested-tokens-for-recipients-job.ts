// READ BEFORE RUNNING!:
// - Make sure the nextTriggerUTCDate is updated, and is in the future EVERY time before running the script
// Otherwise it'll call setTimeout() with a negative value which causes an infinite loop. Can drain the account's AVAX.

// @NOTE: KEEP THE PROD KEY IMPORT COMMENTED OUT BY DEFAULT TO SAFEGUARD AGAINST ACCIDENTAL SCRIPT RUNS
// import masterKeys from "../prod-master-keys";
import masterKeys from "../../../test-master-keys";

import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { TransactionConfig } from "web3-core";
import { config } from "../../../config";
import VESTING_VAULT_JSON from "../../../build/contracts/VestingVault.json";
import { globalTokenGrants } from "../data/token-grants";
import { differenceInMilliseconds, addMonths } from "date-fns";
import { runAtDate } from "../../utils/run-at-date";

// Contract info
const VESTING_VAULT_ABI = VESTING_VAULT_JSON.abi as AbiItem[];

// @TODO: When VESTING_VAULT_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const VESTING_VAULT_ADDRESS = "0x8Cd0eB872d0CE547013F0e02203CF92De0624b90";

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const vestingVaultInstance = new web3.eth.Contract(VESTING_VAULT_ABI, VESTING_VAULT_ADDRESS);

web3.eth.handleRevert = true;

// @TODO: Set the real desired claiming time when running in production
// NOTE: When restarting script remember to update this!!!
let nextTriggerUTCDate = new Date("2022-03-02T08:41:00Z");
let timeUntilNextClaimsTriggeredInMillis = differenceInMilliseconds(nextTriggerUTCDate, new Date());

const claimForAllRecipients = async () => {
    // Compute the scheduling parameters for the next call before the network calls
    // Otherwise there'll be a slight drift every month due to the time taken for the network calls
    nextTriggerUTCDate = addMonths(nextTriggerUTCDate, 1);
    timeUntilNextClaimsTriggeredInMillis = differenceInMilliseconds(nextTriggerUTCDate, new Date());

    for (const address of globalTokenGrants.keys()) {
        try {
            // vestingInfo object is of the form { monthsVested: string; amountVested: string; }
            // but web3 returns it as { 0: string; 1: string; }
            const vestingInfo = await vestingVaultInstance.methods.calculateGrantClaim(address).call();

            // Only try to claim if there are some vested tokens
            // This also acts as a safeguard against accidentally draining our AVAX due to infinite loop of claim calls
            if (vestingInfo["0"] !== "0") {
                const data = vestingVaultInstance.methods.claimVestedTokensForRecipient(address).encodeABI();
                const txData: TransactionConfig = {
                    from: masterKeys.claimer.address,
                    to: VESTING_VAULT_ADDRESS,
                    gas: "1000000",
                    gasPrice: web3.utils.toWei("80", "gwei"),
                    data,
                };
                const signedTxData = await web3.eth.accounts.signTransaction(txData, masterKeys.claimer.privateKey);
                const result = await web3.eth.sendSignedTransaction(signedTxData.rawTransaction!);
                console.log(`${JSON.stringify(result)}\n`);
                console.log(`Vested tokens claimed for: ${address}\n`);
            } else {
                console.log(`There are no vested tokens available to claim for recipient: ${address}`);
            }
        } catch (err) {
            console.log(`${JSON.stringify(err)}\n`);
        }
    }

    console.log("Done making all claim calls");
    console.log(`Next claims scheduled for ${nextTriggerUTCDate.toUTCString()}`);

    runAtDate(nextTriggerUTCDate, async () => {
        await claimForAllRecipients();
    });
};

function main() {
    runAtDate(nextTriggerUTCDate, async () => {
        // Adding this condition as a precaution in case I forget to update the `nextTriggerUTCDate`
        // when re-running the script (and it's in the past). Could otherwise drain our AVAX!
        console.log(timeUntilNextClaimsTriggeredInMillis);
        if (timeUntilNextClaimsTriggeredInMillis > 0) {
            await claimForAllRecipients();
        }
    });
}

main();
