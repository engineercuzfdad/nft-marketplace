const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ deployments, getNamedAccounts }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const waitBlockConfirmations = developmentChains.includes(network.name)
    ? 1
    : VERIFICATION_BLOCK_CONFIRMATIONS;

  log("----------------------------------------------------");

  if (network) args = [];

  //if (network.name.includes(developmentChains))
  if (developmentChains.includes(network.name)) {
    log("Local Network Detected..!!!");
    log("Please wait Deploying");

    await deploy("NftMarketPlace", {
      from: deployer,
      log: true,
      args: args,
      waitConfirmations: waitBlockConfirmations,
    });
  }
};

module.exports.tags = ["all", "NftMarketPlace"];
