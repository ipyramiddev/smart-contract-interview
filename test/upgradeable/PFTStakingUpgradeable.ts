import { deployProxy, upgradeProxy } from '@openzeppelin/truffle-upgrades';
import bigInt from 'big-integer';
import { localExpect } from '../lib/test-libraries';
import { PFTStakingUpgradeableInstance, MultiSigWalletInstance, PFTStakingUpgradeableTestInstance } from '../../types/truffle-contracts';
import PFT_STAKING_UPGRADEABLE_JSON from '../../build/contracts/PFTStakingUpgradeable.json';
import Web3 from 'web3';
import { AbiItem } from 'web3-utils';
import { getTxIdFromMultiSigWallet } from '../lib/test-helpers';

const config = require('../../config').config;

const PFTStakingUpgradeable = artifacts.require('PFTStakingUpgradeable');
const multiSigWallet = artifacts.require('MultiSigWallet');
const PFTStakingUpgradeableTest = artifacts.require('PFTStakingUpgradeableTest');

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localSubnetHTTP));
const PFT_STAKING_UPGRADEABLE_ABI = PFT_STAKING_UPGRADEABLE_JSON.abi as AbiItem[];

contract.skip('PFTStakingUpgradeable.sol', ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PFTStakingUpgradeableInstance: PFTStakingUpgradeableInstance;
    let multiSigWalletInstance: MultiSigWalletInstance;
    let PFTStakingUpgradeableTestInstance: PFTStakingUpgradeableTestInstance;
    let PFTStakingUpgradeableContract: any;

    beforeEach(async () => {
        // Require 2 signatures for multiSig
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2], 2);

        PFTStakingUpgradeableInstance = (await deployProxy(PFTStakingUpgradeable as any, ['1000'], {
            initializer: 'initialize',
        })) as PFTStakingUpgradeableInstance;
        await PFTStakingUpgradeableInstance.transferOwnership(multiSigWalletInstance.address);

        PFTStakingUpgradeableContract = new web3.eth.Contract(PFT_STAKING_UPGRADEABLE_ABI, PFTStakingUpgradeableInstance.address);
    });

    it('allows the user to stake the minimum staking amount', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await localExpect(PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount })).to.eventually.be.fulfilled;
        const balanceOfStakingContract = (await web3.eth.getBalance(PFTStakingUpgradeableInstance.address)).toString();
        expect(balanceOfStakingContract).to.equal(minimumStakingAmount);
        const { amount } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(amount.toString()).to.equal(minimumStakingAmount);
    });

    it('reverts if the user tries to stake less than the minimum staking amount for an initial stake', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await localExpect(PFTStakingUpgradeableInstance.stake({ from: account1, value: bigInt(minimumStakingAmount).minus(1).toString() })).to.eventually.be.rejected;
    });

    it('allows users to top up a stake', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        const { startTime: startTime1 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        const topUpAmount = '123';
        await localExpect(PFTStakingUpgradeableInstance.stake({ from: account1, value: topUpAmount })).to.eventually.be.fulfilled;
        const { startTime: startTime2 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime2).to.equal(startTime1);
    });

    it('allows users to top up a stake to the new minimum staking amount', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        const { startTime: startTime1 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);

        let data = PFTStakingUpgradeableContract.methods.setMinimumStakeAmount('2500').encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTStakingUpgradeableInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        const { startTime: startTime2 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime2.toString()).to.equal(startTime1.toString());

        const topUpAmount = '1500';
        await localExpect(PFTStakingUpgradeableInstance.stake({ from: account1, value: topUpAmount })).to.eventually.be.fulfilled;
        const { startTime: startTime3 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(parseInt(startTime3.toString())).to.be.greaterThan(parseInt(startTime1.toString()));
    });

    it('allows the user to unstake all their PFT', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        const { startTime: startTime1, amount: amount1 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime1).to.not.equal('0');
        expect(amount1).to.equal('3000');
        await PFTStakingUpgradeableInstance.unstakeAll({ from: account1 });
        const { startTime: startTime2, amount: amount2 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime2).to.equal('0');
        expect(amount2).to.equal('0');
    });

    it('reverts if there is no PFT to unstake', async () => {
        await localExpect(PFTStakingUpgradeableInstance.unstakeAll({ from: account1 })).to.eventually.be.rejected;
        await localExpect(PFTStakingUpgradeableInstance.unstakeExcessAmount({ from: account1 })).to.eventually.be.rejected;
        await localExpect(PFTStakingUpgradeableInstance.unstakeExactAmount('1', { from: account1 })).to.eventually.be.rejected;
        const { startTime, amount } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime).to.equal('0');
        expect(amount).to.equal('0');
    });

    it('allows the user to unstake excess PFT', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        const { startTime: startTime1, amount: amount1 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime1).to.not.equal('0');
        expect(amount1).to.equal('3000');
        await PFTStakingUpgradeableInstance.unstakeExcessAmount({ from: account1 });
        const { startTime: startTime2, amount: amount2 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime2).to.equal(startTime1);
        expect(amount2).to.equal('1000');
    });

    it('reverts if the unstakeExcess is called and there is no excess PFT staked', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        await localExpect(PFTStakingUpgradeableInstance.unstakeExcessAmount({ from: account1 })).to.eventually.be.rejected;
        const { startTime, amount } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime).to.not.equal('0');
        expect(amount).to.equal('1000');
    });

    it('allows the user to unstake an exact amount of PFT', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        const { startTime: startTime1 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        await PFTStakingUpgradeableInstance.unstakeExactAmount('1', { from: account1 });
        const { startTime: startTime2, amount: amount2 } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime2).to.equal(startTime1);
        expect(amount2).to.equal('999');
    });

    it('reverts if the user tries to unstake an exact amount that is greater than what they have staked', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });
        await localExpect(PFTStakingUpgradeableInstance.unstakeExactAmount('2001', { from: account1 })).to.eventually.be.rejected;
    });

    it('can be upgraded and store new state variables from the new contract', async () => {
        const minimumStakingAmount = (await PFTStakingUpgradeableInstance.minimumStakeAmount()).toString();
        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });

        // Now upgrade the contract
        PFTStakingUpgradeableTestInstance = (await upgradeProxy(PFTStakingUpgradeableInstance.address, PFTStakingUpgradeableTest as any, {})) as PFTStakingUpgradeableInstance;

        // The unstakeAll function is missing in the upgraded contract so we'd expect any calls to fail
        await localExpect((PFTStakingUpgradeableInstance as PFTStakingUpgradeableInstance).unstakeAll({ from: account1 })).to.eventually.be.rejected;

        await PFTStakingUpgradeableInstance.stake({ from: account1, value: minimumStakingAmount });

        const { startTime, amount } = await PFTStakingUpgradeableInstance.getStakeInfo(account1);
        expect(startTime).to.not.equal('0');
        expect(amount).to.equal('2000');
    });
});
