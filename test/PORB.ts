const PORB = artifacts.require("PORB");

contract("PORB.sol", () => {
    it("can be deployed", async () => {
        await PORB.deployed();
    });
});
