import { promises as fs } from "fs";
import path from "path";

async function main() {
  const deploymentsDir = path.join(__dirname, "../deployments");
  const outDir = path.join(__dirname, "../frontend/src/abi");
  await fs.mkdir(outDir, { recursive: true });

  const result: Record<string, { chainId: number; chainName: string; address: string }> = {};

  const networks = await fs.readdir(deploymentsDir).catch(() => []);
  for (const net of networks) {
    const file = path.join(deploymentsDir, net, "FriendCircle.json");
    try {
      const raw = await fs.readFile(file, "utf8");
      const parsed = JSON.parse(raw);
      const address: string = parsed.address;
      const chainId: number = parsed.chainId || (net === "localhost" ? 31337 : 0);
      const chainName: string = parsed.networkName || net;
      if (address && address.startsWith("0x")) {
        result[String(chainId || chainName)] = { chainId: chainId || 0, chainName, address };
      }
    } catch {}
  }

  await fs.writeFile(
    path.join(outDir, "FriendCircleAddresses.ts"),
    `export const FriendCircleAddresses = ${JSON.stringify(result, null, 2)} as const;\n`
  );

  console.log("Addresses generated.");
}

main().catch((e) => { console.error(e); process.exit(1); });


