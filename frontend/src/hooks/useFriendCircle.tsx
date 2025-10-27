"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { FhevmDecryptionSignature } from "../fhevm/FhevmDecryptionSignature";
import { FriendCircleABI } from "../abi/FriendCircleABI";

export function useFriendCircle(params: {
  instance: any | undefined;
  provider: ethers.Eip1193Provider | undefined;
  contractAddress: `0x${string}` | undefined;
}) {
  const { instance, provider, contractAddress } = params;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const rpcProvider = useMemo(() => (provider ? new ethers.BrowserProvider(provider) : undefined), [provider]);
  const signerRef = useRef<ethers.JsonRpcSigner | undefined>(undefined);

  const getSigner = useCallback(async () => {
    if (!rpcProvider) return undefined;
    if (signerRef.current) return signerRef.current;
    signerRef.current = await rpcProvider.getSigner();
    return signerRef.current;
  }, [rpcProvider]);

  const getContract = useCallback(async (withSigner: boolean) => {
    if (!contractAddress || !rpcProvider) return undefined;
    const signer = withSigner ? await getSigner() : undefined;
    return new ethers.Contract(contractAddress, FriendCircleABI.abi, signer ?? rpcProvider);
  }, [contractAddress, getSigner, rpcProvider]);

  const createPost = useCallback(async (text: string, ipfsHash: string) => {
    const c = await getContract(true);
    if (!c) return;
    setBusy(true);
    try {
      const tx = await c.createPost(text, ipfsHash);
      await tx.wait();
      setMessage("发布成功");
    } finally { setBusy(false); }
  }, [getContract]);

  const getLikeFeeWei = useCallback(async (): Promise<bigint> => {
    const c = await getContract(false);
    if (!c) return 0n;
    const fee: any = await c.likeFeeWei();
    // 兼容字符串/BigNumber/bigint
    const feeStr = (typeof fee === "object" && fee != null && typeof fee.toString === "function") ? fee.toString() : String(fee);
    return BigInt(feeStr);
  }, [getContract]);

  const like = useCallback(async (postId: bigint, likeFeeWei?: bigint) => {
    if (!instance) return;
    const c = await getContract(true);
    const signer = await getSigner();
    if (!c || !signer || !contractAddress) return;
    setBusy(true);
    try {
      const input = instance.createEncryptedInput(contractAddress, signer.address);
      input.add32(1);
      const enc = await input.encrypt();
      const fee = likeFeeWei ?? (await getLikeFeeWei());
      const tx = await c.like(postId, enc.handles[0], enc.inputProof, { value: fee });
      await tx.wait();
      setMessage("点赞成功");
    } finally { setBusy(false); }
  }, [contractAddress, getContract, getSigner, getLikeFeeWei, instance]);

  const tip = useCallback(async (postId: bigint, amountWei: bigint) => {
    const c = await getContract(true);
    if (!c) return;
    setBusy(true);
    try {
      const tx = await c.tip(postId, { value: amountWei });
      await tx.wait();
      setMessage("打赏成功");
    } finally { setBusy(false); }
  }, [getContract]);

  const getPostMeta = useCallback(async (postId: bigint) => {
    const c = await getContract(false);
    if (!c) return undefined;
    const [author, text, ipfsHash, timestamp] = await c.getPost(postId);
    return { author, text, ipfsHash, timestamp: Number(timestamp) } as const;
  }, [getContract]);

  const getPostCount = useCallback(async () => {
    const c = await getContract(false);
    if (!c) return 0;
    const count: any = await c.postCount();
    const countStr = (typeof count === "object" && count != null && typeof count.toString === "function") ? count.toString() : String(count);
    return Number(countStr);
  }, [getContract]);

  const getAllPosts = useCallback(async () => {
    const total = await getPostCount();
    const ids = Array.from({ length: total }, (_, i) => BigInt(i + 1));
    const results = await Promise.all(ids.map((id) => getPostMeta(id)));
    return ids.map((id, idx) => ({ id: Number(id), ...(results[idx] as any) })).filter(Boolean);
  }, [getPostCount, getPostMeta]);

  const decryptPostStats = useCallback(async (postId: bigint) => {
    if (!instance || !contractAddress) return { likes: 0n, tips: 0n };
    const c = await getContract(false);
    const signer = await getSigner();
    if (!c || !signer) return { likes: 0n, tips: 0n };

    const likeHandle = (await c.getEncryptedLikeCount(postId)) as string;
    const tipHandle = (await c.getEncryptedTipTotal(postId)) as string;

    const isZeroHandle = (h: any) => typeof h === "string" && /^0x0+$/i.test(h);
    const likeIsZero = isZeroHandle(likeHandle);
    const tipIsZero = isZeroHandle(tipHandle);
    if (likeIsZero && tipIsZero) {
      // 尚无数据，直接返回 0，避免调用解密抛错
      return { likes: 0n, tips: 0n } as const;
    }

    const { publicKey, privateKey } = instance.generateKeypair();
    const sig = await FhevmDecryptionSignature.new(instance, [contractAddress], publicKey, privateKey, signer);
    if (!sig) return { likes: 0n, tips: 0n };

    const items: Array<{ handle: string; contractAddress: string }> = [];
    if (!likeIsZero) items.push({ handle: likeHandle, contractAddress });
    if (!tipIsZero) items.push({ handle: tipHandle, contractAddress });

    try {
      const res = await instance.userDecrypt(
        items,
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );
      return {
        likes: likeIsZero ? 0n : BigInt(res[likeHandle] ?? 0),
        tips: tipIsZero ? 0n : BigInt(res[tipHandle] ?? 0),
      } as const;
    } catch (e: any) {
      const msg = String(e?.message ?? e ?? "");
      if (msg.includes("not authorized") || msg.includes("not authorized to user decrypt")) {
        setMessage("未获解密授权，请先在该帖点击“申请解密权限”并等待上链确认");
        return { likes: 0n, tips: 0n } as const;
      }
      throw e;
    }
  }, [contractAddress, getContract, getSigner, instance]);

  const grantDecryptForPost = useCallback(async (postId: bigint) => {
    const c = await getContract(true);
    if (!c) return;
    setBusy(true);
    try {
      const tx = await c.grantDecryptForPost(postId);
      await tx.wait();
      setMessage("已为当前账户申请该帖的解密权限");
    } finally { setBusy(false); }
  }, [getContract]);

  return { createPost, like, tip, decryptPostStats, getPostMeta, getPostCount, getAllPosts, grantDecryptForPost, busy, message } as const;
}


