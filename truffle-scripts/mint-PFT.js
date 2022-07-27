const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../build/contracts/PFTUpgradeable.json').abi;
const config = require('../config').config;
const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const PFTUpgradeable = artifacts.require('OPFTNativeUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0x1A44477AF531Ab811cd82772477f40750e763ff9';
const PFT_TRANSPARENT_PROXY_ADDRESS = '0x1678B18a370C65004c8e4e03b6bf4bE76EaDf4F1';
const PFT_HOLDER = testAccountsData[2].address;
const PFT_TO_MINT_AMOUNT = web3.utils.toWei('1', 'ether');

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);

        // Mint PFT to an address
        let multiSigData = PFTTransparentProxyContract.methods.mint(PFT_HOLDER, PFT_TO_MINT_AMOUNT).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testAccountsData[0].address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });

        const balanceOfHolder = (await PFTUpgradeableInstance.balanceOf(PFT_HOLDER)).toString();
        console.log(`balanceOfHolder: ${balanceOfHolder} PFT`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
