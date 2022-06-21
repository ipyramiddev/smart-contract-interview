## 2_deploy_upgradeable_contracts.ts
# We call admin.transferProxyAdminOwnership(multiSigWallet.address) in order to transfer proxy admin ownership of all proxies
# to the MultiSigWallet. This ensures contract upgrades can only be done via a multisig. That way we can prevent any exploits associated with unwanted upgrades.

## 3_prepare_and_upgrade_PFT_contract.ts
# In this file we first prepare an upgrade, which can be done by any 'from' address because it doesn't actually upgrade the contract, only prepares it.
# Then the upgrade is done via a multisig. This tells the proxy admin to call the transparent proxy to now point to the new implementation contract.
# I've tested that the upgrades work as expected using PFTUpgradeableTest.sol - which has had it's mint function removed.

## .openzeppelin directory
# Contains JSON files which capture all the addresses of proxy admin, transparent proxies and the implementation contracts.
# This is helpful in many ways. One is in tracking what implementations are already deployed and preventing unnecessary redeployments if we want to reuse an existing, deployed contract.
# The JSON files for testnet and mainnet should be committed to version control.