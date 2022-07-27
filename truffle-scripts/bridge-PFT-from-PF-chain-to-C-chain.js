const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../build/contracts/OPFTNativeUpgradeable.json').abi;
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
const PFT_TO_BRIDGE_AMOUNT = web3.utils.toWei('0.1', 'ether');
const DESTINATION_CHAIN_ID = '10006';
const DESTINATION_ADDRESS = '0x083AE73152d48ad83F15A2Ca8ea9D7743261b780';
const SOURCE_CHAIN_ID = '10028';
const SOURCE_LZ_ENDPOINT = '0xd682ECF100f6F4284138AA925348633B0611Ae21';

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);

        const balanceOfHolder = (await PFTUpgradeableInstance.balanceOf(PFT_HOLDER)).toString();
        console.log(`balanceOfHolder: ${balanceOfHolder}`);

        let multiSigData = PFTTransparentProxyContract.methods.setTrustedRemote(SOURCE_CHAIN_ID, SOURCE_LZ_ENDPOINT).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testAccountsData[0].address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });
        const isTrustedRemote = await PFTUpgradeableInstance.isTrustedRemote(SOURCE_CHAIN_ID, SOURCE_LZ_ENDPOINT);
        console.log(`isTrustedRemote: ${isTrustedRemote}`);

        await PFTUpgradeableInstance.approve(PFT_TRANSPARENT_PROXY_ADDRESS, PFT_TO_BRIDGE_AMOUNT, { from: PFT_HOLDER });
        console.log('amount approved');

        const { nativeFee } = await PFTUpgradeableInstance.estimateSendFee(DESTINATION_CHAIN_ID, DESTINATION_ADDRESS, PFT_TO_BRIDGE_AMOUNT, false, '0x', {
            from: PFT_HOLDER,
        });
        console.log(`nativeFee:${nativeFee.toString()}`);

        await PFTUpgradeableInstance.sendFrom(PFT_HOLDER, DESTINATION_CHAIN_ID, DESTINATION_ADDRESS, PFT_TO_BRIDGE_AMOUNT, PFT_HOLDER, PFT_HOLDER, '0x', {
            from: PFT_HOLDER,
            value: web3.utils.toWei('150', 'ether'),
        });
        console.log('bridging tx complete');
    } catch (error) {
        console.log(error);
    }

    callback();
};
