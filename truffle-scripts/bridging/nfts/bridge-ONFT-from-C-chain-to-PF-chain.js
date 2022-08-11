// Make sure setTrustedRemotes is called (using set-trusted-remotes-for-lz-apps.js) for both directions.
// I.e. for PF-chain ONFT contract, the chainId and ONFT address for the C-chain needs to be set.
// And for the C-chain ONFT contract, the chainId and ONFT address for the PF-chain needs to be set.
// This needs to be done before anything else. If this is not done properly and before anything else, the LZ contracts
// flag this as suspicious and both ONFT contracts need to be redeployed.

const bigInt = require('big-integer');
const ethers = require('ethers');
const Web3 = require('web3');
const ONFT_UPGRADEABLE_ABI = require('../../../build/contracts/PorbleONFTExternalUpgradeable.json').abi;
const config = require('../../../config').config;
const testMasterKeys = require('../../../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../../../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const ONFTUpgradeable = artifacts.require('PorbleONFTExternalUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.testnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0x9eF416998B7b85778c8a3C166eF77E34c7165007';
const ONFT_TRANSPARENT_PROXY_ADDRESS = '0x45f8B611f87e81a14D9Ec6B8DE9a02A30f4e37fA';
const ONFT_HOLDER = testMasterKeys.privateTestAccount3.address;
const TOKEN_ID_TO_BRIDGE = '7';
const DESTINATION_CHAIN_ID = '10028';
const DESTINATION_ADDRESS = testMasterKeys.privateTestAccount4.address;

const DESTINATION_ADDRESS_BYTES = ethers.utils.solidityPack(['address'], [DESTINATION_ADDRESS]);
const adapterParams = ethers.utils.solidityPack(['uint16', 'uint256'], [1, 800000]);

module.exports = async function (callback) {
    try {
        const ONFTTransparentProxyContract = new web3.eth.Contract(ONFT_UPGRADEABLE_ABI, ONFT_TRANSPARENT_PROXY_ADDRESS);
        const multiSigWalletInstance = await MultiSigWallet.at(MULTI_SIG_WALLET_ADDRESS);
        const ONFTUpgradeableInstance = await ONFTUpgradeable.at(ONFT_TRANSPARENT_PROXY_ADDRESS);

        let multiSigData = ONFTTransparentProxyContract.methods.setUseCustomAdapterParams(true).encodeABI();
        await multiSigWalletInstance.submitTransaction(ONFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        const useCustomAdapterParams = await ONFTUpgradeableInstance.useCustomAdapterParams();
        console.log(`useCustomAdapterParams: ${useCustomAdapterParams}`);

        multiSigData = ONFTTransparentProxyContract.methods.setMinDstGasLookup(DESTINATION_CHAIN_ID, 1, 800000).encodeABI();
        await multiSigWalletInstance.submitTransaction(ONFT_TRANSPARENT_PROXY_ADDRESS, 0, multiSigData, { from: testMasterKeys.privateTestAccount1.address });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testMasterKeys.privateTestAccount2.address });
        console.log(`minDstGasLookup set`);

        const { nativeFee, zroFee } = await ONFTUpgradeableInstance.estimateSendFee(DESTINATION_CHAIN_ID, DESTINATION_ADDRESS_BYTES, TOKEN_ID_TO_BRIDGE, false, adapterParams, {
            from: ONFT_HOLDER,
        });
        console.log(`nativeFee: ${nativeFee.toString()}`);
        console.log(`zroFee: ${zroFee.toString()}`);

        const paddedNativeFee = bigInt(nativeFee.toString()).multiply('150').divide('100').toString();

        const result = await ONFTUpgradeableInstance.sendFrom(
            ONFT_HOLDER,
            DESTINATION_CHAIN_ID,
            DESTINATION_ADDRESS_BYTES,
            TOKEN_ID_TO_BRIDGE,
            ONFT_HOLDER,
            '0x0000000000000000000000000000000000000000',
            adapterParams,
            {
                from: ONFT_HOLDER,
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
