import { JsonRpcProvider, ethers } from "ethers";
import { RelayerSDKLoader, isFhevmWindowType } from "./RelayerSDKLoader";
import { SDK_CDN_URL } from "./constants";

export class FhevmAbortError extends Error { constructor(message = "FHEVM operation was cancelled") { super(message); this.name = "FhevmAbortError"; } }

type FhevmRelayerStatusType = "sdk-loading" | "sdk-loaded" | "sdk-initializing" | "sdk-initialized" | "creating";

async function getChainId(providerOrUrl: ethers.Eip1193Provider | string): Promise<number> {
  if (typeof providerOrUrl === "string") {
    const provider = new JsonRpcProvider(providerOrUrl);
    const id = Number((await provider.getNetwork()).chainId);
    provider.destroy();
    return id;
  }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try { return await rpc.send("web3_clientVersion", []); } finally { rpc.destroy(); }
}

async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string): Promise<
  { ACLAddress: `0x${string}`; InputVerifierAddress: `0x${string}`; KMSVerifierAddress: `0x${string}` } | undefined
> {
  const version = await getWeb3Client(rpcUrl);
  if (typeof version !== "string" || !version.toLowerCase().includes("hardhat")) return undefined;
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const md = await rpc.send("fhevm_relayer_metadata", []);
    if (!md || typeof md !== "object") return undefined;
    if (typeof md.ACLAddress !== "string" || !md.ACLAddress.startsWith("0x")) return undefined;
    if (typeof md.InputVerifierAddress !== "string" || !md.InputVerifierAddress.startsWith("0x")) return undefined;
    if (typeof md.KMSVerifierAddress !== "string" || !md.KMSVerifierAddress.startsWith("0x")) return undefined;
    return md as any;
  } catch { return undefined; } finally { rpc.destroy(); }
}

type MockResolveResult = { isMock: true; chainId: number; rpcUrl: string };
type GenericResolveResult = { isMock: false; chainId: number; rpcUrl?: string };
type ResolveResult = MockResolveResult | GenericResolveResult;

async function resolve(providerOrUrl: ethers.Eip1193Provider | string, mockChains?: Record<number, string>): Promise<ResolveResult> {
  const chainId = await getChainId(providerOrUrl);
  let rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;
  const defaults: Record<number, string> = { 31337: "http://localhost:8545", ...(mockChains ?? {}) };
  if (Object.hasOwn(defaults, chainId)) {
    if (!rpcUrl) rpcUrl = defaults[chainId];
    return { isMock: true, chainId, rpcUrl };
  }
  return { isMock: false, chainId, rpcUrl };
}

export const createFhevmInstance = async (parameters: {
  provider: ethers.Eip1193Provider | string;
  mockChains?: Record<number, string>;
  signal: AbortSignal;
  onStatusChange?: (status: FhevmRelayerStatusType) => void;
}): Promise<any> => {
  const { provider: providerOrUrl, mockChains, signal, onStatusChange } = parameters;
  const throwIfAborted = () => { if (signal.aborted) throw new FhevmAbortError(); };
  const notify = (s: FhevmRelayerStatusType) => { onStatusChange?.(s); };

  const { isMock, rpcUrl, chainId } = await resolve(providerOrUrl, mockChains);
  if (isMock) {
    const md = await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);
    if (md) {
      notify("creating");
      const { fhevmMockCreateInstance } = await import("./mock/fhevmMock");
      const mock = await fhevmMockCreateInstance({ rpcUrl, chainId, metadata: md });
      throwIfAborted();
      return mock;
    }
  }

  throwIfAborted();
  if (!isFhevmWindowType(window, console.log)) {
    notify("sdk-loading");
    const loader = new RelayerSDKLoader({ trace: console.log });
    await loader.load();
    throwIfAborted();
    notify("sdk-loaded");
  }

  // 确保 SDK 已加载并类型有效后再访问 window.relayerSDK
  if (!isFhevmWindowType(window, console.log)) {
    throw new Error("Relayer SDK is unavailable or invalid after load");
  }
  const win: any = window as any;
  if (win.relayerSDK?.__initialized__ !== true) {
    notify("sdk-initializing");
    const ok = await win.relayerSDK.initSDK();
    if (!ok) throw new Error("initSDK failed");
    win.relayerSDK.__initialized__ = true;
    throwIfAborted();
    notify("sdk-initialized");
  }

  const relayerSDK = (window as any).relayerSDK;
  const aclAddress = relayerSDK.SepoliaConfig.aclContractAddress;
  // 直接创建实例；如需缓存公钥/参数，可对接 IndexedDB（略）
  notify("creating");
  const instance = await relayerSDK.createInstance({ ...relayerSDK.SepoliaConfig, network: providerOrUrl });
  throwIfAborted();
  return instance;
};


