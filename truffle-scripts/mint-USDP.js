const testMasterKeys = require('../test-master-keys').testMasterKeys;
const USDP_UPGRADEABLE_ABI = require('../build/contracts/USDPUpgradeable.json').abi;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0x9D4FC7884108d2377d0F23DD92AF601f7E326295';
const USDP_TRANSPARENT_PROXY_ADDRESS = '0xbAa8E39DF4D8F4344a236541d9b270F28f0703aB';
const MINTED_TO = testMasterKeys.privateTestAccount1.address;

module.exports = async function (callback) {
    try {
        const USDPUpgradeableContract = new web3.eth.Contract(USDP_UPGRADEABLE_ABI, USDP_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);

        const initialUSDPAmountMintedToBuyer = web3.utils.toWei('1000000000', 'ether');

        // Add controller for USDP
        let data = USDPUpgradeableContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDP_TRANSPARENT_PROXY_ADDRESS, 0, data, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });

        // Mint USDP
        data = USDPUpgradeableContract.methods.mint(MINTED_TO, initialUSDPAmountMintedToBuyer).encodeABI();
        await multiSigWalletInstance.submitTransaction(USDP_TRANSPARENT_PROXY_ADDRESS, 0, data, { from: testMasterKeys.privateTestAccount1.address });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });

        console.log('Mint successful');
    } catch (error) {
        console.log(error);
    }

    callback();
};
