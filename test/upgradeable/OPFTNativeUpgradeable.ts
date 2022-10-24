import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import { localExpect, bigInt } from '../lib/test-libraries';
import { OPFTNativeUpgradeableInstance, MultiSigWalletInstance, OPFTNativeUpgradeableTestInstance } from '../../types/truffle-contracts';
import OPFT_NATIVE_UPGRADEABLE_JSON from '../../build/contracts/OPFTNativeUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';
import { testAccountsData } from '../data/test-accounts-data';

const config = require('../../config').config;

const OPFTNativeUpgradeable = artifacts.require('OPFTNativeUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const OPFTNativeUpgradeableTest = artifacts.require('OPFTNativeUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const OPFT_NATIVE_UPGRADEABLE_ABI = OPFT_NATIVE_UPGRADEABLE_JSON.abi as AbiItem[];
const MOCK_LZ_ENDPOINT_PF_CHAIN = testAccountsData[5].address;
const PFT_TO_BRIDGE_AMOUNT = web3.utils.toWei('0.001', 'ether');
const DESTINATION_CHAIN_ID = '10106';
const MOCK_DESTINATION_ADDRESS = testAccountsData[6].address;
const MOCK_DESTINATION_ADDRESS_BYTES = web3.utils.hexToBytes(MOCK_DESTINATION_ADDRESS);

contract.skip('OPFTNativeUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let OPFTNativeUpgradeableInstance: OPFTNativeUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let OPFTNativeUpgradeableTestInstance: OPFTNativeUpgradeableTestInstance;
    let OPFTNativeUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);
        OPFTNativeUpgradeableInstance = (await deployProxy(OPFTNativeUpgradeable as any, [MOCK_LZ_ENDPOINT_PF_CHAIN], {
            initializer: 'initialize',
        })) as OPFTNativeUpgradeableInstance;
        await OPFTNativeUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        OPFTNativeUpgradeableContract = new web3.eth.Contract(OPFT_NATIVE_UPGRADEABLE_ABI, OPFTNativeUpgradeableInstance.address);
    });

    it("has token name set to 'Portal Fantasy Token'", async () => {
        const tokenName = await OPFTNativeUpgradeableInstance.name();
        expect(tokenName).to.equal('Portal Fantasy Token');
    });

    it("has token symbol set to 'PFT'", async () => {
        const tokenSymbol = await OPFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');
    });

    it('has 18 token decimals', async () => {
        const decimals = (await OPFTNativeUpgradeableInstance.decimals()).toString();
        expect(decimals).to.equal('18');
    });

    it('has the contract owner set to the multiSigWallet address', async () => {
        const contractOwner = await OPFTNativeUpgradeableInstance.owner();
        expect(contractOwner).to.equal(multiSigWalletInstance.address);
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        let tokenSymbol = await OPFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        OPFTNativeUpgradeableTestInstance = (await upgradeProxy(OPFTNativeUpgradeableInstance.address, OPFTNativeUpgradeableTest as any)) as OPFTNativeUpgradeableTestInstance;

        // State variables should be unchanged after upgrading contract
        tokenSymbol = await OPFTNativeUpgradeableInstance.symbol();
        expect(tokenSymbol).to.equal('PFT');

        await OPFTNativeUpgradeableTestInstance.setTestNum('123');
        const testNum = (await OPFTNativeUpgradeableTestInstance.testNum()).toString();
        expect(testNum).to.equal('123');
    });

    it('allows a user to set the trusted remotes', async () => {
        // Mocking the PFT address as one of the accounts because the destination address won't be called as part of this tx anyway
        const MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES = web3.utils.hexToBytes(OPFTNativeUpgradeableInstance.address);

        await localExpect(
            OPFTNativeUpgradeableInstance.sendFrom(account2, DESTINATION_CHAIN_ID, MOCK_DESTINATION_ADDRESS_BYTES as any, PFT_TO_BRIDGE_AMOUNT, account2, account2, '0x', {
                from: account2,
                value: web3.utils.toWei('1', 'ether'), // Large fee to ensure the tx passes
            })
        ).to.eventually.be.rejected;

        let data = OPFTNativeUpgradeableContract.methods.setTrustedRemote(DESTINATION_CHAIN_ID, MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES).encodeABI();
        await multiSigWalletInstance.submitTransaction(OPFTNativeUpgradeableInstance.address, 0, data, { from: testAccountsData[0].address });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: testAccountsData[1].address });

        expect(await OPFTNativeUpgradeableInstance.isTrustedRemote(DESTINATION_CHAIN_ID, MOCK_DESTINATION_PFT_TRANSPARENT_PROXY_ADDRESS_BYTES as any)).to.be.true;
    });

    it('allows the user to switch between native PFT to WPFT and vice versa', async () => {
        const amountToWrap = web3.utils.toWei('1', 'ether');
        const amountToUnwrap = web3.utils.toWei('0.8', 'ether');

        const balanceOfWPFTBefore = (await OPFTNativeUpgradeableInstance.balanceOf(account2)).toString();
        await localExpect(OPFTNativeUpgradeableInstance.deposit({ from: account2, value: amountToWrap })).to.be.fulfilled;
        const balanceOfWPFTAfter = (await OPFTNativeUpgradeableInstance.balanceOf(account2)).toString();
        const balanceOfPFTAfterWrap = (await web3.eth.getBalance(account2)).toString();

        expect(bigInt(balanceOfWPFTAfter).minus(balanceOfWPFTBefore).toString()).to.equal(amountToWrap);

        await localExpect(OPFTNativeUpgradeableInstance.withdraw(amountToUnwrap, { from: account2 })).to.be.fulfilled;
        const balanceOfWPFTAfterUnwrap = (await OPFTNativeUpgradeableInstance.balanceOf(account2)).toString();
        const balanceOfPFTAfterUnwrap = (await web3.eth.getBalance(account2)).toString();

        expect(balanceOfWPFTAfterUnwrap).to.equal(bigInt(amountToWrap).minus(amountToUnwrap).toString());
        localExpect(bigInt(balanceOfPFTAfterUnwrap).minus(balanceOfPFTAfterWrap).toString()).to.be.bignumber.at.least(web3.utils.toWei('0.7'));
    });
});
