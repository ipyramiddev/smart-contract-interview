const ethers = require("ethers");
const testAccountsData = require("../test/data/test-accounts-data").testAccountsData;
const config = require("../config").config;

const Porble = artifacts.require("Porble");

// @NOTE: Can switch to using config.ETH.localHTTP when debugging contracts with Ganache
// Will also need to deploy using a truffle migrate --network developmentGanache
const rpcEndpoint = config.AVAX.localHTTP;
const provider = new ethers.providers.JsonRpcProvider(rpcEndpoint);
const signer = new ethers.Wallet(testAccountsData[1].privateKey, provider);

const types = {
    PorbleMintConditions: [
        { name: "minter", type: "address" },
        { name: "tokenId", type: "uint256" },
    ],
};

const porbleMintConditions = { minter: testAccountsData[1].address, tokenId: 1 };

module.exports = async function (callback) {
    try {
        const accounts = await web3.eth.getAccounts();

        const PorbleInstance = await Porble.deployed();

        const domain = {
            name: "PortalFantasy",
            version: "1",
            chainId: 43214,
            verifyingContract: PorbleInstance.address,
        };

        // Sign according to the EIP-712 standard
        const signature = await signer._signTypedData(domain, types, porbleMintConditions);

        // The tokenId and tx sender must match those that have been signed for
        // const result = await PorbleInstance.safeMint(signature, 1, { from: testAccountsData[1].address });
        const result = await PorbleInstance.safeMint(signature, 1);

        console.log(JSON.stringify(result));
    } catch (err) {
        console.log(err);
    }

    callback();
};
