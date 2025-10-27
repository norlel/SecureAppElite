import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const CONTRACT_NAME = "FriendCircle";
const outdir = path.resolve("./src/abi");
if (!fs.existsSync(outdir)) fs.mkdirSync(outdir, { recursive: true });

// 尝试在不同调用上下文下解析 deployments 目录
function resolveDeploymentsDir() {
  const cwd = process.cwd();
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    // 常见：从 frontend 目录执行（npm run genabi）
    path.resolve(cwd, "../deployments"),
    // 偶发：从仓库根目录执行（npm --workspaces 等）
    path.resolve(cwd, "./deployments"),
    // 以脚本文件位置为基准（frontend/scripts -> 到仓库根需要上两级）
    path.resolve(scriptDir, "../../deployments"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return undefined;
}

const deploymentsDir = resolveDeploymentsDir();
if (!deploymentsDir) {
  console.error(
    "Unable to locate deployments directory. Tried '../deployments', './deployments', and script-relative '../../deployments'."
  );
  process.exit(1);
}

function readDeployment(chainName) {
  const file = path.join(deploymentsDir, chainName, `${CONTRACT_NAME}.json`);
  if (!fs.existsSync(file)) return undefined;
  const json = JSON.parse(fs.readFileSync(file, "utf-8"));
  return { abi: json.abi, address: json.address };
}

const localhost = readDeployment("localhost");
if (!localhost) {
  console.error("Unable to locate deployments/localhost/FriendCircle.json. Run `npm run deploy` first.");
  process.exit(1);
}

const sepolia = readDeployment("sepolia") || { abi: localhost.abi, address: "0x0000000000000000000000000000000000000000" };

if (JSON.stringify(localhost.abi) !== JSON.stringify(sepolia.abi)) {
  console.error("Deployments on localhost and Sepolia differ. Consider re-deploying to keep ABI in sync.");
  process.exit(1);
}

const tsAbi = `export const ${CONTRACT_NAME}ABI = ${JSON.stringify({ abi: localhost.abi }, null, 2)} as const;\n`;
const tsAddresses = `export const ${CONTRACT_NAME}Addresses = {\n  "11155111": { address: "${sepolia.address}", chainId: 11155111, chainName: "sepolia" },\n  "31337": { address: "${localhost.address}", chainId: 31337, chainName: "hardhat" },\n};\n`;

fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}ABI.ts`), tsAbi, "utf-8");
fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}Addresses.ts`), tsAddresses, "utf-8");
console.log("Generated FriendCircleABI.ts and FriendCircleAddresses.ts");


