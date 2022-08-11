const ethers = require('ethers');
const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../../../build/contracts/OPFTExternalUpgradeable.json').abi;
const config = require('../../../config').config;
const testMasterKeys = require('../../../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../../../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const PFTUpgradeable = artifacts.require('OPFTExternalUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0xb59110526C196CAB8F6ca82Ca8C1331104b1d70c';
const PFT_TRANSPARENT_PROXY_ADDRESS = '0xa0565592ADF32FC09f17737c3Bf931Fa5cD8A741';
const TRUSTED_CHAIN_ID = '10028'; // PF-chain
// const TRUSTED_CHAIN_ID = '10006'; // C-chain
const TRUSTED_ADDRESS = '0xf898Dfd1f01C9dD12126f3325c3bEE30A075c458';

const TRUSTED_ADDRESS_BYTES = ethers.utils.solidityPack(['address'], [TRUSTED_ADDRESS]);

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);

        let multiSigData = PFTTransparentProxyContract.methods.setTrustedRemote(TRUSTED_CHAIN_ID, TRUSTED_ADDRESS_BYTES).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        const isTrustedRemote = await PFTUpgradeableInstance.isTrustedRemote(TRUSTED_CHAIN_ID, TRUSTED_ADDRESS_BYTES);
        console.log(`isTrustedRemote: ${isTrustedRemote}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
