import { localExpect, bigInt } from "./lib/test-libraries";
import { PFTInstance } from "../types/truffle-contracts";

const PFT = artifacts.require("PFT");

contract.skip("PFT.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PFTInstance: PFTInstance;

    beforeEach(async () => {
        PFTInstance = await PFT.new();
    });

    it("has token name set to 'Portal Fantasy Token'", async () => {
        const tokenName = await PFTInstance.name();
        expect(tokenName).to.equal("Portal Fantasy Token");
    });

    it("has token symbol set to 'PFT'", async () => {
        const tokenSymbol = await PFTInstance.symbol();
        expect(tokenSymbol).to.equal("PFT");
    });

    it("has 18 token decimals", async () => {
        const decimals = (await PFTInstance.decimals()).toString();
        expect(decimals).to.equal("18");
    });

    it("has the contract owner set to the deployer address", async () => {
        const contractOwner = await PFTInstance.owner();
        expect(contractOwner).to.equal(owner);
    });

    it("sets the owner as a controller on construction", async () => {
        const isController = await (PFTInstance as any).controllers.call(owner);
        expect(isController).to.be.true;
    });

    it("allows the contract owner to add a controller", async () => {
        await localExpect(PFTInstance.addController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (PFTInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it("allows the contract owner to remove a controller", async () => {
        await localExpect(PFTInstance.removeController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (PFTInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-owner account to add a controller", async () => {
        await localExpect(PFTInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-owner account to remove a controller", async () => {
        await localExpect(PFTInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("allows a controller account to mint tokens", async () => {
        await PFTInstance.addController(account2, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const totalSupplyBefore = (await PFTInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await PFTInstance.balanceOf(account2)).toString();

        await localExpect(PFTInstance.mint(account2, amountToMint, { from: account2 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PFTInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PFTInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it("allows a controller account to burn tokens", async () => {
        await PFTInstance.addController(account3, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = (await PFTInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await PFTInstance.balanceOf(account3)).toString();

        await PFTInstance.mint(account3, amountToMint, { from: account3 });
        await localExpect(PFTInstance.burn(account3, amountToBurn, { from: account3 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PFTInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PFTInstance.balanceOf(account3)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei("1", "ether");

        await localExpect(PFTInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PFTInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal("0");
    });

    it("doesn't allow a non-controller account to burn tokens", async () => {
        await PFTInstance.addController(account4, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");

        await PFTInstance.mint(account5, amountToMint, { from: account4 });

        await localExpect(PFTInstance.burn(account5, amountToBurn, { from: account5 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PFTInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });
});
