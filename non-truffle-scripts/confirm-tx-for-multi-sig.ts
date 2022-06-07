// This is a general script for confirming any tx (with a valid txId) for a multisig
// Use ts-node to run

// @NOTE: KEEP THE PROD KEY IMPORT COMMENTED OUT BY DEFAULT TO SAFEGUARD AGAINST ACCIDENTAL SCRIPT RUNS
// import masterKeys from "../prod-master-keys";
import masterKeys from '../test-master-keys';

import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { TransactionConfig } from 'web3-core';
import { config } from '../config';
import MULTI_SIG_WALLET_JSON from '../build/contracts/MultiSigWallet.json';

// Contract info
const MULTI_SIG_WALLET_ABI = MULTI_SIG_WALLET_JSON.abi as AbiItem[];

// @TODO: When MULTI_SIG_WALLET_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const MULTI_SIG_WALLET_ADDRESS = '0x52C84043CD9c865236f11d9Fc9F56aa003c1f922';

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const multiSigWalletInstance = new web3.eth.Contract(MULTI_SIG_WALLET_ABI, MULTI_SIG_WALLET_ADDRESS);

web3.eth.handleRevert = true;

const txIdToConfirm = '5';

async function main() {
    try {
        const data = multiSigWalletInstance.methods.confirmTransaction(txIdToConfirm).encodeABI();

        const txData: TransactionConfig = {
            from: masterKeys.multiSigOwner2.address,
            to: MULTI_SIG_WALLET_ADDRESS,
            gas: '1000000',
            gasPrice: web3.utils.toWei('80', 'gwei'),
            data,
        };

        console.log(`Confirming tx with txId=${txIdToConfirm}...`);

        const signedTxData = await web3.eth.accounts.signTransaction(txData, masterKeys.multiSigOwner2.privateKey);
        const result = await web3.eth.sendSignedTransaction(signedTxData.rawTransaction!);

        console.log(`${JSON.stringify(result)}\n`);
        console.log('Tx confirmed and executed');
    } catch (err) {
        console.log(err);
    }
}

main();
