import { localExpect, bigInt } from "./lib/test-libraries";
import { PORBInstance } from "../types/truffle-contracts";

const PORB = artifacts.require("PORB");

contract.skip("PORB.sol", ([owner, account1, account2, account3, account4, account5, account6, account7, account8, account9]) => {
    let PORBInstance: PORBInstance;

    beforeEach(async () => {
        PORBInstance = await PORB.new();
    });

    it("has token name set to 'PORB'", async () => {
        const tokenName = await PORBInstance.name();
        expect(tokenName).to.equal("PORB");
    });

    it("has token symbol set to 'PORB'", async () => {
        const tokenSymbol = await PORBInstance.symbol();
        expect(tokenSymbol).to.equal("PORB");
    });

    it("has 18 token decimals", async () => {
        const decimals = (await PORBInstance.decimals()).toString();
        expect(decimals).to.equal("18");
    });

    it("has the contract owner set to the deployer address", async () => {
        const contractOwner = await PORBInstance.owner();
        expect(contractOwner).to.equal(owner);
    });

    it("allows the contract owner to add a controller", async () => {
        await localExpect(PORBInstance.addController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (PORBInstance as any).controllers.call(account2);
        expect(isController).to.be.true;
    });

    it("allows the contract owner to remove a controller", async () => {
        await localExpect(PORBInstance.removeController(account2, { from: owner })).to.eventually.be.fulfilled;

        const isController = await (PORBInstance as any).controllers.call(account2);
        expect(isController).to.be.false;
    });

    it("doesn't allow a non-owner account to add a controller", async () => {
        await localExpect(PORBInstance.addController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("doesn't allow a non-owner account to remove a controller", async () => {
        await localExpect(PORBInstance.removeController(account2, { from: account1 })).to.eventually.be.rejected;
    });

    it("allows a controller account to mint tokens", async () => {
        await PORBInstance.addController(account2, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const totalSupplyBefore = (await PORBInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(amountToMint).add(bigInt(totalSupplyBefore)).toString();
        const balanceOfAccountBefore = (await PORBInstance.balanceOf(account2)).toString();

        await localExpect(PORBInstance.mint(account2, amountToMint, { from: account2 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PORBInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PORBInstance.balanceOf(account2)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(amountToMint).plus(balanceOfAccountBefore).toString());
    });

    it("allows a controller account to burn tokens", async () => {
        await PORBInstance.addController(account3, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");
        const expectedChangeInTotalSupply = bigInt(amountToMint).subtract(amountToBurn).toString();
        const totalSupplyBefore = await (await PORBInstance.totalSupply()).toString();
        const expectedTotalSupplyAfter = bigInt(totalSupplyBefore).add(bigInt(expectedChangeInTotalSupply)).toString();
        const balanceOfAccountBefore = (await PORBInstance.balanceOf(account3)).toString();

        await PORBInstance.mint(account3, amountToMint, { from: account3 });
        await localExpect(PORBInstance.burn(account3, amountToBurn, { from: account3 })).to.eventually.be.fulfilled;

        const totalSupplyAfter = (await PORBInstance.totalSupply()).toString();

        expect(totalSupplyAfter).to.equal(expectedTotalSupplyAfter);

        const balanceOfAccountAfter = (await PORBInstance.balanceOf(account3)).toString();

        expect(balanceOfAccountAfter).to.equal(bigInt(expectedChangeInTotalSupply).plus(balanceOfAccountBefore).toString());
    });

    it("doesn't allow a non-controller account to mint tokens", async () => {
        const amountToMint = web3.utils.toWei("1", "ether");

        await localExpect(PORBInstance.mint(account4, amountToMint, { from: account4 })).to.eventually.be.rejected;

        const balanceOfAccount = (await PORBInstance.balanceOf(account4)).toString();

        expect(balanceOfAccount).to.equal("0");
    });

    it("doesn't allow a non-controller account to burn tokens", async () => {
        await PORBInstance.addController(account4, { from: owner });

        const amountToMint = web3.utils.toWei("1", "ether");
        const amountToBurn = web3.utils.toWei("0.1", "ether");

        await PORBInstance.mint(account5, amountToMint, { from: account4 });

        await localExpect(PORBInstance.burn(account5, amountToBurn), { from: account5 }).to.eventually.be.rejected;

        const balanceOfAccount = (await PORBInstance.balanceOf(account5)).toString();

        expect(balanceOfAccount).to.equal(amountToMint);
    });
});
