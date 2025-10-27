import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const likeFeeWei = hre.network.name === "hardhat" ? 0 : hre.ethers.parseEther("0.0001");

  await deploy("FriendCircle", {
    from: deployer,
    args: [likeFeeWei],
    log: true,
    waitConfirmations: hre.network.name === "sepolia" ? 2 : 1,
  });
};

export default func;
func.tags = ["FriendCircle"];


