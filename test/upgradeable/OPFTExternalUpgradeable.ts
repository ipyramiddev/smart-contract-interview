import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import { localExpect, bigInt } from '../lib/test-libraries';
import { OPFTExternalUpgradeableInstance, MultiSigWalletInstance, OPFTExternalUpgradeableTestInstance } from '../../types/truffle-contracts';
import OPFT_EXTERNAL_UPGRADEABLE_JSON from '../../build/contracts/OPFTExternalUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';
import { testAccountsData } from '../data/test-accounts-data';

const config = require('../../config').config;

const OPFTExternalUpgradeable = artifacts.require('OPFTExternalUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const OPFTExternalUpgradeableTest = artifacts.require('OPFTExternalUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const OPFT_EXTERNAL_UPGRADEABLE_ABI = OPFT_EXTERNAL_UPGRADEABLE_JSON.abi as AbiItem[];
const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;
const PFT_TO_BRIDGE_AMOUNT = web3.utils.toWei('0.001', 'ether');
const DESTINATION_CHAIN_ID = '10128';
const MOCK_DESTINATION_ADDRESS = testAccountsData[6].address;
const MOCK_DESTINATION_ADDRESS_BYTES = web3.utils.hexToBytes(MOCK_DESTINATION_ADDRESS);

contract.skip('OPFTExternalUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let OPFTExternalUpgradeableInstance: OPFTExternalUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let OPFTExternalUpgradeableTestInstance: OPFTExternalUpgradeableTestInstance;
    let OPFTExternalUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        OPFTExternalUpgradeableInstance = (await deployProxy(OPFTExternalUpgradeable as any, [MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as OPFTExternalUpgradeableInstance;
        await OPFTExternalUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        OPFTExternalUpgradeableContract = new web3.eth.Contract(OPFT_EXTERNAL_UPGRADEABLE_ABI, OPFTExternalUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Token'", async () => {
        const tokenName = await OPFTExternalUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Token');
    });

    it("has token symbol set to 'PFT'", async () => {
        const tokenSymbol = await OPFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');
    });

    it('has 18 token decimals', async () => {
        const decimals = (await OPFTExternalUpgradeableInstance.decimals()).toString();
        expect(decimals).to.equal('18');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await OPFTExternalUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        let tokenSymbol = await OPFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        OPFTExternalUpgradeableTestInstance = (await upgradeProxy(
            OPFTExternalUpgradeableInstance.address,
            OPFTExternalUpgradeableTest as any
        )) as OPFTExternalUpgradeableTestInstance;

        // State variables should be unchanged after upgrading contract
        tokenSymbol = await OPFTExternalUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        await OPFTExternalUpgradeableTestInstance.setTestNum('123');
        const testNum = (await OPFTExternalUpgradeableTestInstance.testNum()).toString();
        expect(testNum).to.equal('123');
    });

    it('allows a user to set the trusted remotes', async () => {
        // Mocking the PFT address as one of the accounts because the destination address won't be called as part of this tx anyway
        const MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES = web3.utils.hexToBytes(OPFTExternalUpgradeableInstance.address);

        await localExpect(
            OPFTExternalUpgradeableInstance.sendFrom(account2, DESTINATION_CHAIN_ID, MOCK_DESTINATION_ADDRESS_BYTES as any, PFT_TO_BRIDGE_AMOUNT, account2, account2, '0x', {
                from: account2,
                value: web3.utils.toWei('1', 'ether'), // Large fee to ensure the tx passes
            })
        ).to.eventually.be.rejected;

        let data = OPFTExternalUpgradeableContract.methods.setTrustedRemote(DESTINATION_CHAIN_ID, MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTExternalUpgradeableInstance.address, 0, data, { from: testAccountsData[0].address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });

        expect(await OPFTExternalUpgradeableInstance.isTrustedRemote(DESTINATION_CHAIN_ID, MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES as any)).to.be.true;
    });
});
