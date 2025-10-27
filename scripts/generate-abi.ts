import { promises as fs } from "fs";
import path from "path";

async function main() {
  const artifactsDir = path.join(__dirname, "../artifacts/contracts");
  const outDir = path.join(__dirname, "../frontend/src/abi");
  await fs.mkdir(outDir, { recursive: true });

  const friendJson = path.join(artifactsDir, "FriendCircle.sol/FriendCircle.json");
  const raw = await fs.readFile(friendJson, "utf8");
  const { abi, bytecode } = JSON.parse(raw);

  await fs.writeFile(
    path.join(outDir, "FriendCircleABI.ts"),
    `export const FriendCircleABI = ${JSON.stringify({ abi }, null, 2)} as const;\n`
  );

  console.log("ABI generated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


