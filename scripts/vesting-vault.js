const ethers = require("ethers");
const testAccountsData = require("../test/data/test-accounts-data").testAccountsData;
const config = require("../config").config;

const PFT = artifacts.require("PFT");
const VestingVault = artifacts.require("VestingVault");

module.exports = async function (callback) {
    try {
        const [owner, account1] = await web3.eth.getAccounts();
        const PFTInstance = await PFT.deployed();
        const VestingVaultInstance = await VestingVault.deployed();

        // Mint some PFT tokens to the owner so that they can deposit this into the vesting contract
        const initialAmountMintedToOwner = web3.utils.toWei("2", "ether");
        await PFTInstance.addController(owner);
        await PFTInstance.mint(owner, initialAmountMintedToOwner);

        // Grant tokens for account1, with a cliff and linear vesting schedule
        const cliffInDays = 2;
        const vestingDurationInDays = 10;
        const amountToGrant = web3.utils.toWei("1", "ether");
        await PFTInstance.approve(VestingVaultInstance.address, amountToGrant);
        await VestingVaultInstance.addTokenGrant(account1, amountToGrant, vestingDurationInDays, cliffInDays);

        const timeIncrement = 60 * 60 * 24 * 7;

        console.log((await getCurrentTime()).toString());

        await advanceTimeAndBlock(timeIncrement);

        console.log((await getCurrentTime()).toString());

        console.log(JSON.stringify(result));
    } catch (err) {
        console.log(err);
    }

    callback();
};
