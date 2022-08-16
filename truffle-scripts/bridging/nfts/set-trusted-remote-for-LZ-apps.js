const ethers = require('ethers');
const Web3 = require('web3');
const ONFT_UPGRADEABLE_ABI = require('../../../build/contracts/PorbleONFTNativeUpgradeable.json').abi;
const config = require('../../../config').config;
const testMasterKeys = require('../../../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../../../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const ONFTUpgradeable = artifacts.require('PorbleONFTNativeUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.testnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0x9D4FC7884108d2377d0F23DD92AF601f7E326295';
const ONFT_TRANSPARENT_PROXY_ADDRESS = '0x2A957D1aD33d0106413968EDfe1efBDf14d1579c';
const TRUSTED_CHAIN_ID = '10028'; // PF-chain
// const TRUSTED_CHAIN_ID = '10006'; // C-chain
const TRUSTED_ADDRESS = '0x6Af959598BEe92D7AFCc506A53b8EdCB22C5432a';

const TRUSTED_ADDRESS_BYTES = ethers.utils.solidityPack(['address'], [TRUSTED_ADDRESS]);

module.exports = async function (callback) {
    try {
        const ONFTTransparentProxyContract = new web3.eth.Contract(ONFT_UPGRADEABLE_ABI, ONFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const ONFTUpgradeableInstance = await ONFTUpgradeable.at(ONFT_TRANSPARENT_PROXY_ADDRESS);

        let multiSigData = ONFTTransparentProxyContract.methods.setTrustedRemote(TRUSTED_CHAIN_ID, TRUSTED_ADDRESS_BYTES).encodeABI();
        await multiSigWalletInstance.submitTransaction(ONFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        const isTrustedRemote = await ONFTUpgradeableInstance.isTrustedRemote(TRUSTED_CHAIN_ID, TRUSTED_ADDRESS_BYTES);
        console.log(`isTrustedRemote: ${isTrustedRemote}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
