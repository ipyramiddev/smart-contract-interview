import { localExpect, bigInt, addMonths, differenceInSeconds } from "./lib/test-libraries";
import { advanceTimeAndBlock } from "../scripts/utils/time-travel";
import { PFTInstance, VestingVaultInstance } from "../types/truffle-contracts";

const PFT = artifacts.require("PFT");
const VestingVault = artifacts.require("VestingVault");

// @TODO: Currently having to run the tests with Ganache because of the time-travel feature. ava-sim doesn't seem to
// have this. Look into an alternative way to time-travel in ava-sim. Until then, remember to skip these tests and
// run against Ganache manually when necessary.

contract("VestingVault.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PFTInstance: PFTInstance;
    let VestingVaultInstance: VestingVaultInstance;
    let initialAmountMintedToOwner: string;

    beforeEach(async () => {
        PFTInstance = await PFT.new();
        VestingVaultInstance = await VestingVault.new(PFTInstance.address);

        // Mint 1B PFT and transfer to the owner
        // Approve the vesting contract to have access to all of this
        initialAmountMintedToOwner = web3.utils.toWei("1000000000", "ether");
        await PFTInstance.addController(owner);
        await PFTInstance.mint(owner, initialAmountMintedToOwner);
        await PFTInstance.approve(VestingVaultInstance.address, initialAmountMintedToOwner);
    });

    it("is able to create a grant and transfer tokens belonging to the owner to the vesting contract", async () => {
        // Grant tokens for account1, with a cliff and linear vesting schedule
        const cliffInMonths = 2;
        const vestingDurationInMonths = 10;
        const amountToGrant = web3.utils.toWei("1", "ether");
        await VestingVaultInstance.addTokenGrant(account1, amountToGrant, vestingDurationInMonths, cliffInMonths);

        const balanceOfOwner = (await PFTInstance.balanceOf(owner)).toString();
        const balanceOfVestingContract = (await PFTInstance.balanceOf(VestingVaultInstance.address)).toString();

        const expectedBalanceOfOwner = bigInt(initialAmountMintedToOwner).subtract(amountToGrant).toString();
        const expectedBalanceOfVestingContract = amountToGrant;

        expect(balanceOfOwner).to.equal(expectedBalanceOfOwner);
        expect(balanceOfVestingContract).to.equal(expectedBalanceOfVestingContract);
    });

    it("vests the correct amount 3 months after the TGE, which can be claimed for the recipient", async () => {
        // Grant tokens for account1, with a cliff and linear vesting schedule
        const cliffInMonths = 2;
        const vestingDurationInMonths = 10;
        const amountToGrant = web3.utils.toWei("1", "ether");
        await VestingVaultInstance.addTokenGrant(account1, amountToGrant, vestingDurationInMonths, cliffInMonths);

        // Time travel
        const timeInMonthsIncrement = 3;
        const timeInSecondsIncrement = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement);

        // Expect the claim to be successful because some tokens should have vested after time travel
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;

        const balanceOfRecipient = (await PFTInstance.balanceOf(account1)).toString();

        const expectedTokensClaimed = web3.utils.toWei(((timeInMonthsIncrement - cliffInMonths) / vestingDurationInMonths).toString(), "ether");

        expect(balanceOfRecipient).to.equal(expectedTokensClaimed);
    });

    it("vests the correct amount 7 months after the TGE, which can be claimed for the recipient", async () => {
        // Grant tokens for account1, with a cliff and linear vesting schedule
        const cliffInMonths = 2;
        const vestingDurationInMonths = 10;
        const amountToGrant = web3.utils.toWei("1", "ether");
        await VestingVaultInstance.addTokenGrant(account1, amountToGrant, vestingDurationInMonths, cliffInMonths);

        // Time travel
        const timeInMonthsIncrement = 7;
        const timeInSecondsIncrement = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement);

        // Expect the claim to be successful because some tokens should have vested after time travel
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;

        const balanceOfRecipient = (await PFTInstance.balanceOf(account1)).toString();

        const expectedTokensClaimed = web3.utils.toWei(((timeInMonthsIncrement - cliffInMonths) / vestingDurationInMonths).toString(), "ether");

        expect(balanceOfRecipient).to.equal(expectedTokensClaimed);
    });

    it("vests nothing for three separate seed recipients, 4 months after the TGE because the cliff is still in the future", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 12;
        const totalAmountToGrantToSeed = web3.utils.toWei("30000000", "ether");

        // Allocate fractions of the total amount to each recipient to simulate investor stakes
        const totalAmountToGrantToRecipient1 = bigInt(totalAmountToGrantToSeed).multiply(5).divide(10).toString(); // 50%
        const totalAmountToGrantToRecipient2 = bigInt(totalAmountToGrantToSeed).multiply(3).divide(10).toString(); // 30%
        const totalAmountToGrantToRecipient3 = bigInt(totalAmountToGrantToSeed).multiply(2).divide(10).toString(); // 20%

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrantToRecipient1, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account2, totalAmountToGrantToRecipient2, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account3, totalAmountToGrantToRecipient3, vestingDurationInMonths, cliffInMonths);

        // Time travel
        const timeInMonthsIncrement = 4;
        const timeInSecondsIncrement = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement);

        // Expect all claims to fail because cliff not reached yet, so no tokens vested
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.rejected;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.rejected;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.rejected;
    });

    it("vests nothing for three separate seed recipients, 6 months after the TGE because the first vesting is 1 month after the cliff", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 12;
        const totalAmountToGrantToSeed = web3.utils.toWei("30000000", "ether");

        // Allocate fractions of the total amount to each recipient to simulate investor stakes
        const totalAmountToGrantToRecipient1 = bigInt(totalAmountToGrantToSeed).multiply(5).divide(10).toString(); // 50%
        const totalAmountToGrantToRecipient2 = bigInt(totalAmountToGrantToSeed).multiply(3).divide(10).toString(); // 30%
        const totalAmountToGrantToRecipient3 = bigInt(totalAmountToGrantToSeed).multiply(2).divide(10).toString(); // 20%

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrantToRecipient1, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account2, totalAmountToGrantToRecipient2, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account3, totalAmountToGrantToRecipient3, vestingDurationInMonths, cliffInMonths);

        // Time travel
        const timeInMonthsIncrement = cliffInMonths;
        const timeInSecondsIncrement = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement);

        // Expect all claims to be rejected because we expect the first vesting to be 1 month after the cliff
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.rejected;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.rejected;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.rejected;
    });

    it("vests the correct amounts 8 months after the TGE (during linear vesting), which can be claimed for the various recipients", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 12;
        const totalAmountToGrantToSeed = web3.utils.toWei("30000000", "ether");

        // Allocate fractions of the total amount to each recipient to simulate investor stakes
        const totalAmountToGrantToRecipient1 = bigInt(totalAmountToGrantToSeed).multiply(5).divide(10).toString(); // 50%
        const totalAmountToGrantToRecipient2 = bigInt(totalAmountToGrantToSeed).multiply(3).divide(10).toString(); // 30%
        const totalAmountToGrantToRecipient3 = bigInt(totalAmountToGrantToSeed).multiply(2).divide(10).toString(); // 20%

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrantToRecipient1, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account2, totalAmountToGrantToRecipient2, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account3, totalAmountToGrantToRecipient3, vestingDurationInMonths, cliffInMonths);

        // Time travel
        const timeInMonthsIncrement = 8;
        const timeInSecondsIncrement = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement);

        // Expect all claims to be fulfilled because we've already entered the linear vesting phase
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.fulfilled;

        const balanceOfRecipient1 = (await PFTInstance.balanceOf(account1)).toString();
        const tokensVestedPerMonthForRecipient1 = bigInt(totalAmountToGrantToRecipient1).divide(vestingDurationInMonths);
        const expectedTokensClaimedForRecipient1 = bigInt(tokensVestedPerMonthForRecipient1)
            .multiply(timeInMonthsIncrement - cliffInMonths)
            .toString();

        expect(balanceOfRecipient1).to.equal(expectedTokensClaimedForRecipient1);

        const balanceOfRecipient2 = (await PFTInstance.balanceOf(account2)).toString();
        const tokensVestedPerMonthForRecipient2 = bigInt(totalAmountToGrantToRecipient2).divide(vestingDurationInMonths);
        const expectedTokensClaimedForRecipient2 = bigInt(tokensVestedPerMonthForRecipient2)
            .multiply(timeInMonthsIncrement - cliffInMonths)
            .toString();

        expect(balanceOfRecipient2).to.equal(expectedTokensClaimedForRecipient2);

        const balanceOfRecipient3 = (await PFTInstance.balanceOf(account3)).toString();
        const tokensVestedPerMonthForRecipient3 = bigInt(totalAmountToGrantToRecipient3).divide(vestingDurationInMonths);
        const expectedTokensClaimedForRecipient3 = bigInt(tokensVestedPerMonthForRecipient3)
            .multiply(timeInMonthsIncrement - cliffInMonths)
            .toString();

        expect(balanceOfRecipient3).to.equal(expectedTokensClaimedForRecipient3);
    });

    it("vests the correct amounts 18 months after the TGE (at the end of linear vesting), which can be claimed for the various recipients", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 12;
        const totalAmountToGrantToSeed = web3.utils.toWei("30000000", "ether");

        // Allocate fractions of the total amount to each recipient to simulate investor stakes
        const totalAmountToGrantToRecipient1 = bigInt(totalAmountToGrantToSeed).multiply(5).divide(10).toString(); // 50%
        const totalAmountToGrantToRecipient2 = bigInt(totalAmountToGrantToSeed).multiply(3).divide(10).toString(); // 30%
        const totalAmountToGrantToRecipient3 = bigInt(totalAmountToGrantToSeed).multiply(2).divide(10).toString(); // 20%

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrantToRecipient1, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account2, totalAmountToGrantToRecipient2, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account3, totalAmountToGrantToRecipient3, vestingDurationInMonths, cliffInMonths);

        // Time travel
        const timeInMonthsIncrement = vestingDurationInMonths;
        const timeInSecondsIncrement = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement);

        // Expect all claims to be fulfilled because we've already entered the linear vesting phase
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.fulfilled;

        const balanceOfRecipient1 = (await PFTInstance.balanceOf(account1)).toString();
        const tokensVestedPerMonthForRecipient1 = bigInt(totalAmountToGrantToRecipient1).divide(vestingDurationInMonths);
        const expectedTokensClaimedForRecipient1 = bigInt(tokensVestedPerMonthForRecipient1)
            .multiply(timeInMonthsIncrement - cliffInMonths)
            .toString();

        expect(balanceOfRecipient1).to.equal(expectedTokensClaimedForRecipient1);

        const balanceOfRecipient2 = (await PFTInstance.balanceOf(account2)).toString();
        const tokensVestedPerMonthForRecipient2 = bigInt(totalAmountToGrantToRecipient2).divide(vestingDurationInMonths);
        const expectedTokensClaimedForRecipient2 = bigInt(tokensVestedPerMonthForRecipient2)
            .multiply(timeInMonthsIncrement - cliffInMonths)
            .toString();

        expect(balanceOfRecipient2).to.equal(expectedTokensClaimedForRecipient2);

        const balanceOfRecipient3 = (await PFTInstance.balanceOf(account3)).toString();
        const tokensVestedPerMonthForRecipient3 = bigInt(totalAmountToGrantToRecipient3).divide(vestingDurationInMonths);
        const expectedTokensClaimedForRecipient3 = bigInt(tokensVestedPerMonthForRecipient3)
            .multiply(timeInMonthsIncrement - cliffInMonths)
            .toString();

        expect(balanceOfRecipient3).to.equal(expectedTokensClaimedForRecipient3);
    });

    it("vests the correct amounts 32 months after the TGE (a long time after the end of linear vesting), which can be claimed for the various recipients", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 12;
        const totalAmountToGrantToSeed = web3.utils.toWei("30000000", "ether");

        // Allocate fractions of the total amount to each recipient to simulate investor stakes
        const totalAmountToGrantToRecipient1 = bigInt(totalAmountToGrantToSeed).multiply(5).divide(10).toString(); // 50%
        const totalAmountToGrantToRecipient2 = bigInt(totalAmountToGrantToSeed).multiply(3).divide(10).toString(); // 30%
        const totalAmountToGrantToRecipient3 = bigInt(totalAmountToGrantToSeed).multiply(2).divide(10).toString(); // 20%

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrantToRecipient1, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account2, totalAmountToGrantToRecipient2, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account3, totalAmountToGrantToRecipient3, vestingDurationInMonths, cliffInMonths);

        // Time travel
        const timeInMonthsIncrement = 32;
        const timeInSecondsIncrement = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement);

        // Expect all claims to be fulfilled because we've already entered the linear vesting phase
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.fulfilled;

        const balanceOfRecipient1 = (await PFTInstance.balanceOf(account1)).toString();
        expect(balanceOfRecipient1).to.equal(totalAmountToGrantToRecipient1);

        const balanceOfRecipient2 = (await PFTInstance.balanceOf(account2)).toString();
        expect(balanceOfRecipient2).to.equal(totalAmountToGrantToRecipient2);

        const balanceOfRecipient3 = (await PFTInstance.balanceOf(account3)).toString();
        expect(balanceOfRecipient3).to.equal(totalAmountToGrantToRecipient3);
    });

    it("allows multiple claims at various points in the vesting schedule for multiple seed grants", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 12;
        const totalAmountToGrantToSeed = web3.utils.toWei("30000000", "ether");

        // Allocate fractions of the total amount to each recipient to simulate investor stakes
        const totalAmountToGrantToRecipient1 = bigInt(totalAmountToGrantToSeed).multiply(5).divide(10).toString(); // 50%
        const totalAmountToGrantToRecipient2 = bigInt(totalAmountToGrantToSeed).multiply(3).divide(10).toString(); // 30%
        const totalAmountToGrantToRecipient3 = bigInt(totalAmountToGrantToSeed).multiply(2).divide(10).toString(); // 20%

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrantToRecipient1, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account2, totalAmountToGrantToRecipient2, vestingDurationInMonths, cliffInMonths);
        await VestingVaultInstance.addTokenGrant(account3, totalAmountToGrantToRecipient3, vestingDurationInMonths, cliffInMonths);

        // Time travel #1 (9 months)
        const timeInMonthsIncrement1 = 9;
        const timeInSecondsIncrement1 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement1), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement1);

        // Expect all claims to be fulfilled because we've already entered the linear vesting phase
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.fulfilled;

        let balanceOfRecipient1 = (await PFTInstance.balanceOf(account1)).toString();
        const tokensVestedPerMonthForRecipient1 = bigInt(totalAmountToGrantToRecipient1).divide(vestingDurationInMonths);
        let expectedTokensClaimedForRecipient1 = bigInt(tokensVestedPerMonthForRecipient1)
            .multiply(timeInMonthsIncrement1 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient1).to.equal(expectedTokensClaimedForRecipient1);

        let balanceOfRecipient2 = (await PFTInstance.balanceOf(account2)).toString();
        const tokensVestedPerMonthForRecipient2 = bigInt(totalAmountToGrantToRecipient2).divide(vestingDurationInMonths);
        let expectedTokensClaimedForRecipient2 = bigInt(tokensVestedPerMonthForRecipient2)
            .multiply(timeInMonthsIncrement1 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient2).to.equal(expectedTokensClaimedForRecipient2);

        let balanceOfRecipient3 = (await PFTInstance.balanceOf(account3)).toString();
        const tokensVestedPerMonthForRecipient3 = bigInt(totalAmountToGrantToRecipient3).divide(vestingDurationInMonths);
        let expectedTokensClaimedForRecipient3 = bigInt(tokensVestedPerMonthForRecipient3)
            .multiply(timeInMonthsIncrement1 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient3).to.equal(expectedTokensClaimedForRecipient3);

        // Time travel #2 (12 months)
        const timeInMonthsIncrement2 = 3;
        const timeInSecondsIncrement2 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement2), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement2);

        // Expect all claims to be fulfilled because we've already entered the linear vesting phase
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.fulfilled;

        balanceOfRecipient1 = (await PFTInstance.balanceOf(account1)).toString();
        expectedTokensClaimedForRecipient1 = bigInt(tokensVestedPerMonthForRecipient1)
            .multiply(timeInMonthsIncrement1 + timeInMonthsIncrement2 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient1).to.equal(expectedTokensClaimedForRecipient1);

        balanceOfRecipient2 = (await PFTInstance.balanceOf(account2)).toString();
        expectedTokensClaimedForRecipient2 = bigInt(tokensVestedPerMonthForRecipient2)
            .multiply(timeInMonthsIncrement1 + timeInMonthsIncrement2 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient2).to.equal(expectedTokensClaimedForRecipient2);

        balanceOfRecipient3 = (await PFTInstance.balanceOf(account3)).toString();
        expectedTokensClaimedForRecipient3 = bigInt(tokensVestedPerMonthForRecipient3)
            .multiply(timeInMonthsIncrement1 + timeInMonthsIncrement2 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient3).to.equal(expectedTokensClaimedForRecipient3);

        // Time travel #3 (16 months)
        const timeInMonthsIncrement3 = 4;
        const timeInSecondsIncrement3 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement3), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement3);

        // Expect all claims to be fulfilled because we've already entered the linear vesting phase
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.fulfilled;

        balanceOfRecipient1 = (await PFTInstance.balanceOf(account1)).toString();
        expectedTokensClaimedForRecipient1 = bigInt(tokensVestedPerMonthForRecipient1)
            .multiply(timeInMonthsIncrement1 + timeInMonthsIncrement2 + timeInMonthsIncrement3 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient1).to.equal(expectedTokensClaimedForRecipient1);

        balanceOfRecipient2 = (await PFTInstance.balanceOf(account2)).toString();
        expectedTokensClaimedForRecipient2 = bigInt(tokensVestedPerMonthForRecipient2)
            .multiply(timeInMonthsIncrement1 + timeInMonthsIncrement2 + timeInMonthsIncrement3 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient2).to.equal(expectedTokensClaimedForRecipient2);

        balanceOfRecipient3 = (await PFTInstance.balanceOf(account3)).toString();
        expectedTokensClaimedForRecipient3 = bigInt(tokensVestedPerMonthForRecipient3)
            .multiply(timeInMonthsIncrement1 + timeInMonthsIncrement2 + timeInMonthsIncrement3 - cliffInMonths)
            .toString();

        expect(balanceOfRecipient3).to.equal(expectedTokensClaimedForRecipient3);

        // Time travel #4 (20 months, after the linear vesting period has ended)
        const timeInMonthsIncrement4 = 4;
        const timeInSecondsIncrement4 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement4), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement4);

        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account2, { from: owner })).to.eventually.be.fulfilled;
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account3, { from: owner })).to.eventually.be.fulfilled;

        balanceOfRecipient1 = (await PFTInstance.balanceOf(account1)).toString();
        expect(balanceOfRecipient1).to.equal(totalAmountToGrantToRecipient1);

        balanceOfRecipient2 = (await PFTInstance.balanceOf(account2)).toString();
        expect(balanceOfRecipient2).to.equal(totalAmountToGrantToRecipient2);

        balanceOfRecipient3 = (await PFTInstance.balanceOf(account3)).toString();
        expect(balanceOfRecipient3).to.equal(totalAmountToGrantToRecipient3);
    });

    it("has the correct monthsClaimed value when the grant is fully claimed", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 12;
        const totalAmountToGrant = web3.utils.toWei("30000000", "ether");

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrant, vestingDurationInMonths, cliffInMonths);

        // Time travel #1 (10 months)
        const timeInMonthsIncrement1 = 10;
        const timeInSecondsIncrement1 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement1), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement1);

        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;

        // Time travel #2 (25 months)
        const timeInMonthsIncrement2 = 15;
        const timeInSecondsIncrement2 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement2), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement2);

        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;

        const monthsClaimed = (await VestingVaultInstance.getGrantMonthsClaimed(account1)).toString();

        expect(monthsClaimed).to.equal(vestingDurationInMonths.toString());
    });

    it("rejects any claims made after the grant has already been fully claimed", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 12;
        const totalAmountToGrant = web3.utils.toWei("30000000", "ether");

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrant, vestingDurationInMonths, cliffInMonths);

        // Time travel #1 (25 months)
        const timeInMonthsIncrement1 = 25;
        const timeInSecondsIncrement1 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement1), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement1);

        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;

        // Time travel #2 (2 months)
        const timeInMonthsIncrement2 = 2;
        const timeInSecondsIncrement2 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement2), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement2);

        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.rejected;
    });

    it("allows the owner to revoke all granted tokens if the recipient hasn't claimed any yet", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 18;
        const totalAmountToGrantToTeamMember = web3.utils.toWei("17000000", "ether");

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrantToTeamMember, vestingDurationInMonths, cliffInMonths);

        // Time travel (25 months)
        const timeInMonthsIncrement = 25;
        const timeInSecondsIncrement = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement);

        await VestingVaultInstance.revokeTokenGrant(account1, { from: owner });

        // Expect claim to fail because the grant has already been revoked
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.rejected;
    });

    it("allows the owner to revoke part of all granted tokens if the recipient has already claimed some", async () => {
        const cliffInMonths = 6;
        const vestingDurationInMonths = 18;
        const totalAmountToGrantToTeamMember = web3.utils.toWei("17000000", "ether");

        await VestingVaultInstance.addTokenGrant(account1, totalAmountToGrantToTeamMember, vestingDurationInMonths, cliffInMonths);

        // Time travel #1 (10 months)
        const timeInMonthsIncrement1 = 10;
        const timeInSecondsIncrement1 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement1), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement1);

        // Can claim because the owner hasn't revoked the grant yet
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.fulfilled;

        let balanceOfTeamMember = (await PFTInstance.balanceOf(account1)).toString();
        const tokensVestedPerMonthForTeamMember = bigInt(totalAmountToGrantToTeamMember).divide(vestingDurationInMonths);
        let expectedTokensClaimedForTeamMember = bigInt(tokensVestedPerMonthForTeamMember)
            .multiply(timeInMonthsIncrement1 - cliffInMonths)
            .toString();

        expect(balanceOfTeamMember).to.equal(expectedTokensClaimedForTeamMember);

        const balanceOfOwnerBefore = (await PFTInstance.balanceOf(owner)).toString();

        // Time travel #2 (20 months)
        const timeInMonthsIncrement2 = 10;
        const timeInSecondsIncrement2 = differenceInSeconds(addMonths(Date.now(), timeInMonthsIncrement2), Date.now());
        await advanceTimeAndBlock(timeInSecondsIncrement2);

        // Revoking, so no futher tokens can be claimed for the team member
        await VestingVaultInstance.revokeTokenGrant(account1, { from: owner });

        balanceOfTeamMember = (await PFTInstance.balanceOf(account1)).toString();

        expectedTokensClaimedForTeamMember = bigInt(tokensVestedPerMonthForTeamMember)
            .multiply(timeInMonthsIncrement1 + timeInMonthsIncrement2 - cliffInMonths)
            .toString();

        expect(balanceOfTeamMember).to.equal(expectedTokensClaimedForTeamMember);

        const balanceOfOwnerAfter = (await PFTInstance.balanceOf(owner)).toString();

        const tokensGainedByOwner = bigInt(balanceOfOwnerAfter).subtract(balanceOfOwnerBefore).toString();
        const expectedTokensGainedByOwner = bigInt(totalAmountToGrantToTeamMember).subtract(balanceOfTeamMember).toString();

        expect(tokensGainedByOwner).to.equal(expectedTokensGainedByOwner);

        // Expect claim to fail because the grant has already been revoked
        await localExpect(VestingVaultInstance.claimVestedTokensForRecipient(account1, { from: owner })).to.eventually.be.rejected;

        // Expect token balance of team member to remain unchanged
        expect(balanceOfTeamMember).to.equal(expectedTokensClaimedForTeamMember);
    });
});
