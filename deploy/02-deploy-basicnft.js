const { network } = require("hardhat");
const { developmentChains } = require("../helper-hardhat-config");

module.exports = async ({ deployments, getNamedAccounts }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  if (developmentChains.includes(network.name)) {
    log("Local Network Detected...!! Deplyoing");

    args = [];

    await deploy("BasicNft", {
      from: deployer,
      log: true,
      args: args,
      waitBlockConfirmations: 1,
    });
  }
};

module.exports.tags = ["all", "BasicNft"];
