const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../build/contracts/PFTUpgradeable.json').abi;
const config = require('../config').config;
const testAccountsData = require('../test/data/test-accounts-data').testAccountsData;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
let web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));

const PFT_TRANSPARENT_PROXY_ADDRESS = '0x6E65a3F8aCB801A8B6bA4fcc9374D9Cf7232BB5E';

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.deployed();

        // Mint using multisig
        multiSigData = PFTTransparentProxyContract.methods.mint(testAccountsData[1].address, '1').encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testAccountsData[0].address });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });

        const balanceOfAccount1 = await PFTTransparentProxyContract.methods.balanceOf(testAccountsData[1].address).call();
        console.log(`PFT balance of account1=${balanceOfAccount1}`);
    } catch (error) {
        console.log(error);
    }

    callback();
};
