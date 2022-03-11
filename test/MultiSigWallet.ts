import { bigInt, localExpect } from "./lib/test-libraries";
import { HeroInstance, PORBInstance, MultiSigWalletInstance, PFTInstance } from "../types/truffle-contracts";
import MULTI_SIG_WALLET_JSON from "../build/contracts/MultiSigWallet.json";
import HERO_JSON from "../build/contracts/Hero.json";
import PORB_JSON from "../build/contracts/PORB.json";
import PFT_JSON from "../build/contracts/PFT.json";
import Web3 from "web3";
import { AbiItem } from "web3-utils";
import { getTxIdFromMultiSigWallet } from "./lib/test-helpers";

const config = require("../config").config;

const hero = artifacts.require("Hero");
const PORB = artifacts.require("PORB");
const PFT = artifacts.require("PFT");
const multiSigWallet = artifacts.require("MultiSigWallet");

const web3 = new Web3(new Web3.providers.HttpProvider(config.AVAX.localHTTP));
const HERO_ABI = HERO_JSON.abi as AbiItem[];
const PORB_ABI = PORB_JSON.abi as AbiItem[];
const PFT_ABI = PFT_JSON.abi as AbiItem[];
const MULTI_SIG_WALLET_ABI = MULTI_SIG_WALLET_JSON.abi as AbiItem[];

contract.skip("MultiSigWallet.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let multiSigWalletInstance: MultiSigWalletInstance;
    let heroInstance: HeroInstance;
    let PORBInstance: PORBInstance;
    let PFTInstance: PFTInstance;
    let heroContract: any;
    let multiSigWalletContract: any;
    let PORBContract: any;
    let PFTContract: any;
    let requiredConfirmations = 4;

    beforeEach(async () => {
        multiSigWalletInstance = await multiSigWallet.new([owner, account1, account2, account3, account4], requiredConfirmations);
        PORBInstance = await PORB.new(account1, owner);
        PFTInstance = await PFT.new();
        heroInstance = await hero.new(PORBInstance.address, account9);
        await heroInstance.transferOwnership(multiSigWalletInstance.address);
        await PORBInstance.transferOwnership(multiSigWalletInstance.address);
        await PFTInstance.transferOwnership(multiSigWalletInstance.address);

        heroContract = new web3.eth.Contract(HERO_ABI, heroInstance.address);
        multiSigWalletContract = new web3.eth.Contract(MULTI_SIG_WALLET_ABI, multiSigWalletInstance.address);
    });

    it("needs tx confirmations equal to the required confirmations in order to execute a tx", async () => {
        // Confirmation #1
        const data = heroContract.methods.setBaseURIString("https://www.foo.com/").encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        let baseURIString = await heroInstance.baseURIString();
        expect(baseURIString).to.equal("https://www.portalfantasy.io/");

        // Confirmation #2
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        baseURIString = await heroInstance.baseURIString();
        expect(baseURIString).to.equal("https://www.portalfantasy.io/");

        // Confirmation #3
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        baseURIString = await heroInstance.baseURIString();
        expect(baseURIString).to.equal("https://www.portalfantasy.io/");

        // Confirmation #4
        await multiSigWalletInstance.confirmTransaction(txId, { from: account4 });
        baseURIString = await heroInstance.baseURIString();
        expect(baseURIString).to.equal("https://www.foo.com/");

        const confirmationCount = Number((await multiSigWalletInstance.getConfirmationCount(txId)).toString());
        expect(confirmationCount).to.equal(requiredConfirmations);
    });

    it("only allows new owners to be added via a multiSig", async () => {
        // Expect this to get rejected because we're attempted to add an owner with a single sig
        await localExpect(multiSigWalletInstance.addOwner(account5, { from: account1 })).to.eventually.be.rejected;

        let owners = await multiSigWalletInstance.getOwners();
        expect(owners).not.to.include(account5);

        const data = multiSigWalletContract.methods.addOwner(account5).encodeABI();
        await multiSigWalletInstance.submitTransaction(multiSigWalletInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account4 });

        owners = await multiSigWalletInstance.getOwners();
        expect(owners).to.include(account5);
    });

    it("only allows owners to be removed via a multiSig", async () => {
        // Expect this to get rejected because we're attempted to remove an owner with a single sig
        await localExpect(multiSigWalletInstance.removeOwner(account4, { from: account1 })).to.eventually.be.rejected;

        let owners = await multiSigWalletInstance.getOwners();
        expect(owners).to.include(account4);

        const data = multiSigWalletContract.methods.removeOwner(account4).encodeABI();
        await multiSigWalletInstance.submitTransaction(multiSigWalletInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        owners = await multiSigWalletInstance.getOwners();
        expect(owners).not.to.include(account4);
    });

    it("only allows owners to be replaced via a multiSig", async () => {
        // Expect this to get rejected because we're attempted to remove an owner with a single sig
        await localExpect(multiSigWalletInstance.replaceOwner(account4, account5, { from: account1 })).to.eventually.be.rejected;

        let owners = await multiSigWalletInstance.getOwners();
        expect(owners).to.include(account4);
        expect(owners).not.to.include(account5);

        const data = multiSigWalletContract.methods.replaceOwner(account4, account5).encodeABI();
        await multiSigWalletInstance.submitTransaction(multiSigWalletInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account4 });

        owners = await multiSigWalletInstance.getOwners();
        expect(owners).not.to.include(account4);
        expect(owners).to.include(account5);
    });

    it("only allows required confirmations to be changed via a multiSig", async () => {
        // Expect this to get rejected because we're attempted to remove an owner with a single sig
        const newRequiredConfirmations = 3;
        await localExpect(multiSigWalletInstance.changeRequirement(newRequiredConfirmations, { from: account1 })).to.eventually.be.rejected;

        let requirement = Number((await multiSigWalletInstance.required()).toString());
        expect(requirement).to.equal(requiredConfirmations);

        const data = multiSigWalletContract.methods.changeRequirement(newRequiredConfirmations).encodeABI();
        await multiSigWalletInstance.submitTransaction(multiSigWalletInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account4 });

        requirement = Number((await multiSigWalletInstance.required()).toString());
        expect(requirement).to.equal(newRequiredConfirmations);
    });

    it("returns the addresses that have confirmed a tx", async () => {
        // Confirmation #1
        const data = heroContract.methods.setBaseURIString("https://www.foo.com/").encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);

        let confirmations = await multiSigWalletInstance.getConfirmations(txId);
        expect(confirmations).to.deep.equal([owner]);

        // Confirmation #2
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        confirmations = await multiSigWalletInstance.getConfirmations(txId);
        expect(confirmations).to.deep.equal([owner, account1]);

        // Confirmation #3
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });
        confirmations = await multiSigWalletInstance.getConfirmations(txId);
        expect(confirmations).to.deep.equal([owner, account1, account3]);

        // Confirmation #4
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        confirmations = await multiSigWalletInstance.getConfirmations(txId);
        expect(confirmations).to.deep.equal([owner, account1, account2, account3]);
    });

    it("returns the txIds as expected", async () => {
        // Setting requirements lower to make this test smaller
        const newRequiredConfirmations = 2;

        let data = multiSigWalletContract.methods.changeRequirement(newRequiredConfirmations).encodeABI();
        await multiSigWalletInstance.submitTransaction(multiSigWalletInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account4 });

        // Proceed with test
        data = heroContract.methods.setBaseURIString("https://www.foo.com/").encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId1 = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId1, { from: account1 });
        let txCount = Number((await multiSigWalletInstance.getTransactionCount(true, true)).toString());
        let txIds: BN[] | string[] = await multiSigWalletInstance.getTransactionIds(0, txCount, true, true);
        txIds = txIds.map((idBN) => idBN.toString());

        expect(txCount).to.equal(2);
        expect(txIds).to.deep.equal([txId, txId1]);

        data = heroContract.methods.setBaseURIString("https://www.bar.com/").encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId2 = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId2, { from: account1 });
        txCount = Number((await multiSigWalletInstance.getTransactionCount(true, true)).toString());
        txIds = await multiSigWalletInstance.getTransactionIds(0, txCount, true, true);
        txIds = txIds.map((idBN) => idBN.toString());

        expect(txCount).to.equal(3);
        expect(txIds).to.deep.equal([txId, txId1, txId2]);

        data = heroContract.methods.setBaseURIString("https://www.baz.com/").encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId3 = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId3, { from: account1 });
        txCount = Number((await multiSigWalletInstance.getTransactionCount(true, true)).toString());
        txIds = await multiSigWalletInstance.getTransactionIds(0, txCount, true, true);
        txIds = txIds.map((idBN) => idBN.toString());

        expect(txCount).to.equal(4);
        expect(txIds).to.deep.equal([txId, txId1, txId2, txId3]);
    });

    it("stores a failed tx in the global tx array, but marks it with executed = false", async () => {
        // Call to mintWithPORB will revert because multiSigWallet doesn't have sufficient PORB
        const data = heroContract.methods.mintWithPORB().encodeABI();
        await multiSigWalletInstance.submitTransaction(heroInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        const { executed } = await (multiSigWalletInstance as any).transactions.call(txId);

        expect(executed).to.be.false;
    });

    it("can withdraw the AVAX balance on the contract with a multiSig", async () => {
        // Initially send some AVAX to the multiSigWallet instance
        const avaxAmountToSend = web3.utils.toWei("1", "ether");
        await multiSigWalletInstance.send(avaxAmountToSend);
        const balanceOfMultiSigWallet = await web3.eth.getBalance(multiSigWalletInstance.address);

        expect(balanceOfMultiSigWallet).to.equal(avaxAmountToSend);

        // Withdraw the AVAX to a different account
        const accountBalanceBeforeWithdrawal = (await web3.eth.getBalance(account9)).toString();

        // Withdrawal requires a multiSig so this should fail
        await localExpect(multiSigWalletInstance.withdrawAVAX(account9, avaxAmountToSend)).to.eventually.be.rejected;

        const data = multiSigWalletContract.methods.withdrawAVAX(account9, avaxAmountToSend).encodeABI();
        await multiSigWalletInstance.submitTransaction(multiSigWalletInstance.address, 0, data, { from: owner });
        const txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        const accountBalanceAfterWithdrawal = (await web3.eth.getBalance(account9)).toString();
        const avaxWithdrawn = bigInt(accountBalanceAfterWithdrawal).subtract(accountBalanceBeforeWithdrawal).toString();

        expect(avaxWithdrawn).to.equal(avaxAmountToSend);
    });

    it("can withdraw the PORB balance of the contract with a multiSig", async () => {
        // MultiSig for adding MultiSigWallet contract as a controller
        // Even though MultiSigWallet is currently the owner, it must be a controller before it can mint
        PORBContract = new web3.eth.Contract(PORB_ABI, PORBInstance.address);
        let data = PORBContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        // Mint to MultiSigWallet
        const initialAmountMintedToOwner = web3.utils.toWei("1", "ether");
        data = PORBContract.methods.mint(multiSigWalletInstance.address, initialAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        // Withdraw PORB to a different account
        const accountBalanceBeforeWithdrawal = (await PORBInstance.balanceOf(account9)).toString();

        // Withdrawal requires a multiSig so this should fail
        await localExpect(PORBInstance.transfer(account9, initialAmountMintedToOwner)).to.eventually.be.rejected;

        data = PORBContract.methods.transfer(account9, initialAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PORBInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        const accountBalanceAfterWithdrawal = (await PORBInstance.balanceOf(account9)).toString();
        const PORBWithdrawn = bigInt(accountBalanceAfterWithdrawal).subtract(accountBalanceBeforeWithdrawal).toString();

        expect(PORBWithdrawn).to.equal(initialAmountMintedToOwner);
    });

    it("can withdraw the PFT balance of the contract with a multiSig", async () => {
        // MultiSig for adding MultiSigWallet contract as a controller
        // Even though MultiSigWallet is currently the owner, it must be a controller before it can mint
        PFTContract = new web3.eth.Contract(PFT_ABI, PFTInstance.address);
        let data = PFTContract.methods.addController(multiSigWalletInstance.address).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        let txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        // Mint to MultiSigWallet
        const initialAmountMintedToOwner = web3.utils.toWei("1", "ether");
        data = PFTContract.methods.mint(multiSigWalletInstance.address, initialAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        // Withdraw PFT to a different account
        const accountBalanceBeforeWithdrawal = (await PFTInstance.balanceOf(account9)).toString();

        // Withdrawal requires a multiSig so this should fail
        await localExpect(PFTInstance.transfer(account9, initialAmountMintedToOwner)).to.eventually.be.rejected;

        data = PFTContract.methods.transfer(account9, initialAmountMintedToOwner).encodeABI();
        await multiSigWalletInstance.submitTransaction(PFTInstance.address, 0, data, { from: owner });
        txId = await getTxIdFromMultiSigWallet(multiSigWalletInstance);
        await multiSigWalletInstance.confirmTransaction(txId, { from: account1 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account2 });
        await multiSigWalletInstance.confirmTransaction(txId, { from: account3 });

        const accountBalanceAfterWithdrawal = (await PFTInstance.balanceOf(account9)).toString();
        const PFTWithdrawn = bigInt(accountBalanceAfterWithdrawal).subtract(accountBalanceBeforeWithdrawal).toString();

        expect(PFTWithdrawn).to.equal(initialAmountMintedToOwner);
    });
});
