// @NOTE: This is one-time-use script to start the the INITIAL grants
// If further grants need to be created after running this, then we should use the file `start-single-token-grant-post-TGE.ts`

// @NOTE: KEEP THE PROD KEY IMPORT COMMENTED OUT BY DEFAULT TO SAFEGUARD AGAINST ACCIDENTAL SCRIPT RUNS
// import masterKeys from "../prod-master-keys";
import masterKeys from '../../test-master-keys';

import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { TransactionConfig } from 'web3-core';
import { config } from '../../config';
import VESTING_VAULT_JSON from '../../build/contracts/VestingVault.json';
import MULTI_SIG_WALLET_JSON from '../../build/contracts/MultiSigWallet.json';
import { globalTokenGrants, categoryToVestingParameters } from './data/token-grants';
import { getTxIdFromMultiSigWallet } from '../utils/get-tx-id-from-multi-sig-wallet';

// Contract info
const VESTING_VAULT_ABI = VESTING_VAULT_JSON.abi as AbiItem[];
const MULTI_SIG_WALLET_ABI = MULTI_SIG_WALLET_JSON.abi as AbiItem[];

// @TODO: When VESTING_VAULT_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const VESTING_VAULT_ADDRESS = '0x8B3BC4270BE2abbB25BC04717830bd1Cc493a461';

// @TODO: When MULTI_SIG_WALLET_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const MULTI_SIG_WALLET_ADDRESS = '0x52C84043CD9c865236f11d9Fc9F56aa003c1f922';

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const vestingVaultInstance = new web3.eth.Contract(VESTING_VAULT_ABI, VESTING_VAULT_ADDRESS);
const multiSigWalletInstance = new web3.eth.Contract(MULTI_SIG_WALLET_ABI, MULTI_SIG_WALLET_ADDRESS);

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
            const dataForCallFromMultiSigWallet = vestingVaultInstance.methods.addTokenGrant(address, allocation, vestingDurationInMonths, cliffInMonths).encodeABI();

            const data = multiSigWalletInstance.methods.submitTransaction(VESTING_VAULT_ADDRESS, 0, dataForCallFromMultiSigWallet).encodeABI();

            const txData: TransactionConfig = {
                from: masterKeys.multiSigOwner1.address,
                to: MULTI_SIG_WALLET_ADDRESS,
                gas: '1000000',
                gasPrice: web3.utils.toWei('80', 'gwei'),
                data,
            };

            const signedTxData = await web3.eth.accounts.signTransaction(txData, masterKeys.multiSigOwner1.privateKey);
            const result = await web3.eth.sendSignedTransaction(signedTxData.rawTransaction!);
            const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);

            console.log(`${JSON.stringify(result)}\n`);
            console.log(`Submitted initial tx for adding new grant for recipient: ${address}, with txId=${txId}\n`);
        } catch (err) {
            console.log(err);
        }
    }
}

main();
