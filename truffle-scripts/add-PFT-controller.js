const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../build/contracts/PFTUpgradeable.json').abi;
const config = require('../config').config;
const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0xC7E9B2Bc37b0eFB6402f05590786c56d24677355';
const PFT_TRANSPARENT_PROXY_ADDRESS = '0x8c91829eF1420a6F8Ab3B71C81dc2DA13777ED25';
const NEW_PFT_CONTROLLER_ADDRESS = '0xE304503b21F0Dd41e6635e197305ff41A3A6fBBA';

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);

        // Add new address as a controller of PFT
        let multiSigData = PFTTransparentProxyContract.methods.addController(NEW_PFT_CONTROLLER_ADDRESS).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testAccountsData[0].address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });

        const isController = await PFTTransparentProxyContract.methods.controllers(NEW_PFT_CONTROLLER_ADDRESS).call();
        console.log(`isController: ${isController}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
