const ethers = require('ethers');
const Web3 = require('web3');
const USDP_UPGRADEABLE_ABI = require('../../../build/contracts/WrappedOFTUpgradeable.json').abi;
const config = require('../../../config').config;
const testMasterKeys = require('../../../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../../../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const USDPUpgradeable = artifacts.require('WrappedOFTUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0xb59110526C196CAB8F6ca82Ca8C1331104b1d70c';
const USDP_TRANSPARENT_PROXY_ADDRESS = '0x2943f696c8614af76C37e281e102C7eC5C5F7EEE';
const TRUSTED_CHAIN_ID = '10128'; // PF-chain
// const TRUSTED_CHAIN_ID = '10106'; // C-chain
const TRUSTED_ADDRESS = '0x4C727363D272933D906aA86ddd8f664075a21f6A';

module.exports = async function (callback) {
    try {
        const USDPTransparentProxyContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDP_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const USDPUpgradeableInstance = await USDPUpgradeable.at(USDP_TRANSPARENT_PROXY_ADDRESS);

        let multiSigData = USDPTransparentProxyContract.methods.setTrustedRemote(TRUSTED_CHAIN_ID, TRUSTED_ADDRESS_BYTES).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDP_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        const isTrustedRemote = await USDPUpgradeableInstance.isTrustedRemote(TRUSTED_CHAIN_ID, TRUSTED_ADDRESS_BYTES);
        console.log(`isTrustedRemote: ${isTrustedRemote}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
