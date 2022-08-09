const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../build/contracts/PFTUpgradeable.json').abi;
const config = require('../config').config;
const testMasterKeys = require('../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const PFTUpgradeable = artifacts.require('OPFTNativeUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0xd70a7Bf75ea16fd386Eb756e527028F355f8c36D';
const PFT_TRANSPARENT_PROXY_ADDRESS = '0xDf305033ef5FdfE0Bf128334e7AD92FdbA9d43e9';
const PFT_HOLDER = testMasterKeys.privateTestAccount2.address;
const PFT_TO_MINT_AMOUNT = web3.utils.toWei('1', 'ether');

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);

        // Mint PFT to an address
        let multiSigData = PFTTransparentProxyContract.methods.mint(PFT_HOLDER, PFT_TO_MINT_AMOUNT).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });

        const balanceOfHolder = (await PFTUpgradeableInstance.balanceOf(PFT_HOLDER)).toString();
        console.log(`balanceOfHolder: ${balanceOfHolder} PFT`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
