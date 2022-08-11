// Make sure setTrustedRemotes is called (using set-trusted-remotes-for-lz-apps.js) for both directions.
// I.e. for PF-chain PFT contract, the chainId and PFT address for the C-chain needs to be set.
// And for the C-chain PFT contract, the chainId and PFT address for the PF-chain needs to be set.
// This needs to be done before anything else. If this is not done properly and before anything else, the LZ contracts
// flag this as suspicious and both PFT contracts need to be redeployed.

const ethers = require('ethers');
const Web3 = require('web3');
const PFT_UPGRADEABLE_ABI = require('../../../build/contracts/OPFTNativeUpgradeable.json').abi;
const config = require('../../../config').config;
const testMasterKeys = require('../../../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../../../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const PFTUpgradeable = artifacts.require('OPFTNativeUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.testnetSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0x76E24135C622f3f55C2A5b8CdC69715D4483b4aB';
const PFT_TRANSPARENT_PROXY_ADDRESS = '0xf898Dfd1f01C9dD12126f3325c3bEE30A075c458';
const PFT_HOLDER = testMasterKeys.privateTestAccount2.address;
const PFT_TO_BRIDGE_AMOUNT = web3.utils.toWei('0.001', 'ether');
const DESTINATION_CHAIN_ID = '10006';
const DESTINATION_ADDRESS = testMasterKeys.privateTestAccount3.address;

const DESTINATION_ADDRESS_BYTES = ethers.utils.solidityPack(['address'], [DESTINATION_ADDRESS]);
const adapterParams = ethers.utils.solidityPack(['uint16', 'uint256'], [1, 800000]);

module.exports = async function (callback) {
    try {
        const PFTTransparentProxyContract = new web3.eth.Contract(PFT_UPGRADEABLE_ABI, PFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const PFTUpgradeableInstance = await PFTUpgradeable.at(PFT_TRANSPARENT_PROXY_ADDRESS);

        let multiSigData = PFTTransparentProxyContract.methods.setUseCustomAdapterParams(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        const useCustomAdapterParams = await PFTUpgradeableInstance.useCustomAdapterParams();
        console.log(`useCustomAdapterParams: ${useCustomAdapterParams}`);

        multiSigData = PFTTransparentProxyContract.methods.setMinDstGasLookup(DESTINATION_CHAIN_ID, 1, 800000).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        console.log(`minDstGasLookup set`);

        await PFTUpgradeableInstance.approve(PFT_TRANSPARENT_PROXY_ADDRESS, PFT_TO_BRIDGE_AMOUNT, { from: PFT_HOLDER });
        console.log('amount approved');

        const { nativeFee, zroFee } = await PFTUpgradeableInstance.estimateSendFee(DESTINATION_CHAIN_ID, DESTINATION_ADDRESS_BYTES, PFT_TO_BRIDGE_AMOUNT, false, adapterParams, {
            from: PFT_HOLDER,
        });
        console.log(`nativeFee: ${nativeFee.toString()}`);
        console.log(`zroFee: ${zroFee.toString()}`);

        const result = await PFTUpgradeableInstance.sendFrom(
            PFT_HOLDER,
            DESTINATION_CHAIN_ID,
            DESTINATION_ADDRESS_BYTES,
            PFT_TO_BRIDGE_AMOUNT,
            PFT_HOLDER,
            '0x0000000000000000000000000000000000000000',
            adapterParams,
            {
                from: PFT_HOLDER,
                value: web3.utils.toWei('150', 'ether'), // Needs to include the fee as well as the PFT amount we're looking to bridge
            }
        );
        console.log(`bridging tx complete: ${result.tx}`);
        console.log(JSON.stringify(result.receipt));
    } catch (error) {
        console.log(error);
    }

    callback();
};
