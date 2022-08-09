// Make sure setTrustedRemotes is called (using set-trusted-remotes-for-lz-apps.js) for both directions.
// I.e. for PF-chain PFT contract, the chainId and PFT address for the C-chain needs to be set.
// And for the C-chain PFT contract, the chainId and PFT address for the PF-chain needs to be set.
// This needs to be done before anything else. If this is not done properly and before anything else, the LZ contracts
// flag this as suspicious and both PFT contracts need to be redeployed.

const bigInt = require('big-integer');
const ethers = require('ethers');
const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../build/contracts/OPFTExternalUpgradeable.json').abi;
const config = require('../config').config;
const testMasterKeys = require('../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const PFTUpgradeable = artifacts.require('OPFTExternalUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.testnetSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0xb59110526C196CAB8F6ca82Ca8C1331104b1d70c';
const PFT_TRANSPARENT_PROXY_ADDRESS = '0xa0565592ADF32FC09f17737c3Bf931Fa5cD8A741';
const WPFT_HOLDER = testMasterKeys.privateTestAccount3.address;
const WPFT_TO_BRIDGE_AMOUNT = web3.utils.toWei('0.0001', 'ether');
const DESTINATION_CHAIN_ID = '10028';
const DESTINATION_ADDRESS = '0x083AE73152d48ad83F15A2Ca8ea9D7743261b780';

const DESTINATION_ADDRESS_BYTES = ethers.utils.solidityPack(['address'], [DESTINATION_ADDRESS]);
const adapterParams = ethers.utils.solidityPack(['uint16', 'uint256'], [1, 1200000]);

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);

        const balanceOfHolder = (await PFTUpgradeableInstance.balanceOf(WPFT_HOLDER)).toString();
        console.log(`balanceOfHolder: ${balanceOfHolder}`);

        let multiSigData = PFTTransparentProxyContract.methods.setUseCustomAdapterParams(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        const useCustomAdapterParams = await PFTUpgradeableInstance.useCustomAdapterParams();
        console.log(`useCustomAdapterParams: ${useCustomAdapterParams}`);

        multiSigData = PFTTransparentProxyContract.methods.setMinDstGasLookup(DESTINATION_CHAIN_ID, 1, 1200000).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        console.log(`minDstGasLookup set`);

        await PFTUpgradeableInstance.approve(PFT_TRANSPARENT_PROXY_ADDRESS, WPFT_TO_BRIDGE_AMOUNT, { from: WPFT_HOLDER });
        console.log('amount approved');

        const { nativeFee, zroFee } = await PFTUpgradeableInstance.estimateSendFee(DESTINATION_CHAIN_ID, DESTINATION_ADDRESS_BYTES, WPFT_TO_BRIDGE_AMOUNT, false, adapterParams, {
            from: WPFT_HOLDER,
        });
        console.log(`nativeFee: ${nativeFee.toString()}`);
        console.log(`zroFee: ${zroFee.toString()}`);

        const paddedNativeFee = bigInt(nativeFee.toString()).multiply('150').divide('100').toString();

        const result = await PFTUpgradeableInstance.sendFrom(
            WPFT_HOLDER,
            DESTINATION_CHAIN_ID,
            DESTINATION_ADDRESS_BYTES,
            WPFT_TO_BRIDGE_AMOUNT,
            WPFT_HOLDER,
            '0x0000000000000000000000000000000000000000',
            adapterParams,
            {
                from: WPFT_HOLDER,
                value: paddedNativeFee,
            }
        );

        console.log(`bridging tx complete: ${result.tx}`);
        console.log(JSON.stringify(result.receipt));
    } catch (error) {
        console.log(error);
    }

    callback();
};
