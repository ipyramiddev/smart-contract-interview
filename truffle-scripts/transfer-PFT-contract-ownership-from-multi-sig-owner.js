const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../build/contracts/PFTUpgradeable.json').abi;
const config = require('../config').config;
const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.testnetSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0x1A44477AF531Ab811cd82772477f40750e763ff9';
const PFT_TRANSPARENT_PROXY_ADDRESS = '0x8c91829eF1420a6F8Ab3B71C81dc2DA13777ED25';
const NEW_PFT_OWNER_ADDRESS = '0xE304503b21F0Dd41e6635e197305ff41A3A6fBBA';

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);

        // Add new address as a controller of PFT
        let multiSigData = PFTTransparentProxyContract.methods.transferOwnership(NEW_PFT_OWNER_ADDRESS).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testAccountsData[0].address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });

        const owner = await PFTTransparentProxyContract.methods.owner().call();
        console.log(`isOwner: ${owner === NEW_PFT_OWNER_ADDRESS}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
