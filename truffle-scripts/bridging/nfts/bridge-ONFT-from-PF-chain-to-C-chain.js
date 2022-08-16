// Make sure setTrustedRemotes is called (using set-trusted-remotes-for-lz-apps.js) for both directions.
// I.e. for PF-chain ONFT contract, the chainId and ONFT address for the C-chain needs to be set.
// And for the C-chain ONFT contract, the chainId and ONFT address for the PF-chain needs to be set.
// This needs to be done before anything else. If this is not done properly and before anything else, the LZ contracts
// flag this as suspicious and both ONFT contracts need to be redeployed.

const ethers = require('ethers');
const Web3 = require('web3');
const ONFT_UPGRADEABLE_ABI = require('../../../build/contracts/PorbleONFTNativeUpgradeable.json').abi;
const config = require('../../../config').config;
const testMasterKeys = require('../../../test-master-keys').testMasterKeys;
const getTxIdFromMultiSigWallet = require('../../../test/lib/test-helpers').getTxIdFromMultiSigWallet;

const MultiSigWallet = artifacts.require('MultiSigWallet');
const ONFTUpgradeable = artifacts.require('PorbleONFTNativeUpgradeable');
const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.testnetSubnetHTTP));

// Copy these over from .env file because it's safer to do it manually
const MULTI_SIG_WALLET_ADDRESS = '0x2A6ea17600f4dF457D5a7e6a46E6933ba3C079Ef';
const ONFT_TRANSPARENT_PROXY_ADDRESS = '0x6Af959598BEe92D7AFCc506A53b8EdCB22C5432a';
const ONFT_HOLDER = testMasterKeys.privateTestAccount1.address;
const TOKEN_ID_TO_BRIDGE = '5';
const DESTINATION_CHAIN_ID = '10006';
const DESTINATION_ADDRESS = testMasterKeys.privateTestAccount3.address;

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

        // await ONFTUpgradeableInstance.approve(ONFT_TRANSPARENT_PROXY_ADDRESS, PFT_TO_BRIDGE_AMOUNT, { from: ONFT_HOLDER });
        // console.log('amount approved');

        const { nativeFee, zroFee } = await ONFTUpgradeableInstance.estimateSendFee(DESTINATION_CHAIN_ID, DESTINATION_ADDRESS_BYTES, TOKEN_ID_TO_BRIDGE, false, adapterParams, {
            from: ONFT_HOLDER,
        });
        console.log(`nativeFee: ${nativeFee.toString()}`);
        console.log(`zroFee: ${zroFee.toString()}`);

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
                value: web3.utils.toWei('200', 'ether'), // Needs to include the fee as well as the PFT amount we're looking to bridge
            }
        );
        console.log(`bridging tx complete: ${result.tx}`);
        console.log(JSON.stringify(result.receipt));
    } catch (error) {
        console.log(error);
    }

    callback();
};
