const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../build/contracts/OPFTExternalUpgradeable.json').abi;
const config = require('../config').config;
const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const PFTUpgradeable = artifacts.require('OPFTExternalUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0xb97dcF6bF363Acac5AEc2481d2304816Bde38Ff2';
const PFT_TRANSPARENT_PROXY_ADDRESS = '0x14d90CfF69af99ECF4f4e706Cd077753BE7789F6';
const TRUSTED_CHAIN_ID = '10028';
const TRUSTED_ADDRESS = '0x1678B18a370C65004c8e4e03b6bf4bE76EaDf4F1';

const TRUSTED_ADDRESS_BYTES = web3.utils.hexToBytes(TRUSTED_ADDRESS);

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);

        let multiSigData = PFTTransparentProxyContract.methods.setTrustedRemote(TRUSTED_CHAIN_ID, TRUSTED_ADDRESS_BYTES).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testAccountsData[0].address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });
        const isTrustedRemote = await PFTUpgradeableInstance.isTrustedRemote(TRUSTED_CHAIN_ID, TRUSTED_ADDRESS_BYTES);
        console.log(`isTrustedRemote: ${isTrustedRemote}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
