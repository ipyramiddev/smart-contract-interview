// Helper script for sanity check

import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { config } from '../../config';
import PFT_JSON from '../../build/contracts/PFT.json';

// Contract info
const PFT_ABI = PFT_JSON.abi as AbiItem[];

// @TODO: When PFT_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const PFT_ADDRESS = '0x17aB05351fC94a1a67Bf3f56DdbB941aE6c63E25';

// @TODO: When MULTI_SIG_WALLET_ADDRESS is known for mainnet, add to a config object and reference instead of hard-coding here
const MULTI_SIG_WALLET_ADDRESS = '0x52C84043CD9c865236f11d9Fc9F56aa003c1f922';

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const PFTInstance = new web3.eth.Contract(PFT_ABI, PFT_ADDRESS);

web3.eth.handleRevert = true;

async function main() {
    try {
        const isController = (await PFTInstance.methods.controllers(MULTI_SIG_WALLET_ADDRESS).call()).toString();
        console.log(`isController=${isController}`);
    } catch (err) {
        console.log(err);
    }
}

main();
