"use client";
import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useFhevm } from "../fhevm/useFhevm";
import { useFriendCircle } from "../hooks/useFriendCircle";

declare global { interface Window { ethereum?: any } }

function getContractInfoByChainId(chainId: number | undefined): { address?: `0x${string}`; abi: any[] } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const abiFile = require("../abi/FriendCircleABI");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const addrFile = require("../abi/FriendCircleAddresses");
    const abi = (abiFile?.FriendCircleABI?.abi ?? []) as any[];
    if (!chainId) return { abi };
    const entry = addrFile?.FriendCircleAddresses?.[String(chainId)];
    const address = entry?.address as `0x${string}` | undefined;
    return { address, abi };
  } catch { return { abi: [] }; }
}

// 图标组件
const Icons = {
  Heart: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
    </svg>
  ),
  Gift: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 6h-2.18c.11-.31.18-.65.18-1a2.996 2.996 0 0 0-5.5-1.65l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-2 .89-2 2v4c0 1.11.89 2 2 2h1v6c0 1.11.89 2 2 2h10c1.11 0 2-.89 2-2v-6h1c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z"/>
    </svg>
  ),
  Eye: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
    </svg>
  ),
  Send: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
    </svg>
  ),
  Refresh: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
    </svg>
  ),
  User: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  ),
  Clock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z"/>
      <path d="M12.5 7H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </svg>
  )
};

export default function Home() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const rpc = useMemo(() => (typeof window !== "undefined" ? window.ethereum : undefined), []);
  const [account, setAccount] = useState<string | undefined>(undefined);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      if (!rpc) return;
      setProvider(rpc);
      const id = await rpc.request({ method: "eth_chainId" });
      setChainId(parseInt(id, 16));
      try {
        const accs: string[] = await rpc.request({ method: "eth_accounts" });
        setAccount(accs?.[0]);
      } catch {}
      // 账户/链变更监听
      try {
        const onAccountsChanged = (accs: string[]) => setAccount(accs?.[0]);
        const onChainChanged = (hex: string) => setChainId(parseInt(hex, 16));
        rpc.on?.("accountsChanged", onAccountsChanged);
        rpc.on?.("chainChanged", onChainChanged);
        return () => {
          rpc.removeListener?.("accountsChanged", onAccountsChanged);
          rpc.removeListener?.("chainChanged", onChainChanged);
        };
      } catch {}
    })();
  }, [rpc]);

  useEffect(() => { setMounted(true); }, []);

  const { instance, status } = useFhevm({ provider, chainId, enabled: true, initialMockChains: { 31337: "http://localhost:8545" } });

  const fc = useFriendCircle({ instance, provider, contractAddress: getContractInfoByChainId(chainId).address });

  const [text, setText] = useState("");
  const [ipfs, setIpfs] = useState("");
  const [postId, setPostId] = useState<string>("1");
  const [tipWei, setTipWei] = useState<string>("0");
  const [stats, setStats] = useState<{likes: bigint, tips: bigint}>({ likes: 0n, tips: 0n });
  const [allPosts, setAllPosts] = useState<Array<{ id: number; author: string; text: string; ipfsHash: string; timestamp: number }>>([]);
  const [loadingPosts, setLoadingPosts] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'create' | 'interact' | 'posts'>('posts');
  const [tipInputs, setTipInputs] = useState<Record<number, string>>({});
  const [decStatsByPost, setDecStatsByPost] = useState<Record<number, { likes: bigint; tips: bigint }>>({});

  async function refreshAllPosts() {
    if (!fc) return;
    setLoadingPosts(true);
    try {
      const posts = await fc.getAllPosts();
      setAllPosts(posts);
    } finally { setLoadingPosts(false); }
  }

  const isConnected = getContractInfoByChainId(chainId).address;
  const hasWallet = mounted && !!rpc;
  const isWalletConnected = mounted && !!account;

  async function connectWallet() {
    if (!rpc) return;
    try {
      const accs: string[] = await rpc.request({ method: "eth_requestAccounts" });
      setAccount(accs?.[0]);
      const id = await rpc.request({ method: "eth_chainId" });
      setChainId(parseInt(id, 16));
    } catch (e) {
      console.error(e);
    }
  }

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'connected': return 'status-connected';
      case 'disconnected': return 'status-disconnected';
      default: return 'status-loading';
    }
  };

  return (
    <div className="main-content">
      <div className="container">
        {/* 头部 */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: '700', color: 'var(--primary-color)' }}>
                🌟 FriendCircle
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className={`status-indicator ${getStatusClass(status)}`}>
                  <div className="loading-spinner" style={{ display: status === 'loading' ? 'block' : 'none' }}></div>
                  FHEVM: {status}
                </div>
                {mounted && (
                  isWalletConnected ? (
                    <div className="badge" title={account}>
                      已连接: {account!.slice(0,6)}...{account!.slice(-4)}
                    </div>
                  ) : (
                    <button className="btn btn-primary" onClick={connectWallet} disabled={!hasWallet}>
                      连接钱包
                    </button>
                  )
                )}
              </div>
            </div>
            <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)' }}>
              基于 FHEVM 的隐私保护朋友圈，支持加密点赞和打赏
            </p>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="card" style={{ marginBottom: '2rem' }}>
          <div className="card-header" style={{ padding: '1rem 1.5rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                className={`btn ${activeTab === 'posts' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('posts')}
              >
                <Icons.Eye />
                朋友圈
              </button>
              <button 
                className={`btn ${activeTab === 'create' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('create')}
              >
                <Icons.Send />
                发布动态
              </button>
              <button 
                className={`btn ${activeTab === 'interact' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => setActiveTab('interact')}
              >
                <Icons.Heart />
                互动操作
              </button>
            </div>
          </div>
        </div>

        {/* 消息提示 */}
        {fc.message && (
          <div className={`message ${fc.message.includes('成功') ? 'message-success' : 'message-error'}`}>
            {fc.message}
          </div>
        )}

        {/* 内容区域 */}
        <div className="grid grid-cols-1">
          {/* 发布动态 */}
          {activeTab === 'create' && (
            <div className="card">
              <div className="card-header">
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Icons.Send />
                  发布新动态
                </h3>
              </div>
              <div className="card-body">
                <div className="grid grid-cols-1" style={{ gap: '1rem' }}>
                  <div className="input-group">
                    <label className="label">动态内容</label>
                    <textarea 
                      className="input textarea" 
                      placeholder="分享你的想法..." 
                      value={text} 
                      onChange={(e) => setText(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="input-group">
                    <label className="label">IPFS 哈希 (可选)</label>
                    <input 
                      className="input" 
                      placeholder="输入 IPFS 哈希以附加文件" 
                      value={ipfs} 
                      onChange={(e) => setIpfs(e.target.value)} 
                    />
                  </div>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => fc.createPost(text, ipfs)} 
                    disabled={fc.busy || !isConnected || !text.trim()}
                  >
                    {fc.busy ? (
                      <>
                        <div className="loading-spinner"></div>
                        发布中...
                      </>
                    ) : (
                      <>
                        <Icons.Send />
                        发布动态
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 互动操作 */}
          {activeTab === 'interact' && (
            <div className="grid grid-cols-1" style={{ gap: '1.5rem' }}>
              {/* 点赞 */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icons.Heart />
                    点赞动态
                  </h3>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div className="input-group">
                      <label className="label">动态 ID</label>
                      <input 
                        className="input" 
                        placeholder="输入动态 ID" 
                        value={postId} 
                        onChange={(e) => setPostId(e.target.value)} 
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      <button 
                        className="btn btn-success" 
                        onClick={() => fc.like(BigInt(postId || "1"))} 
                        disabled={fc.busy || !isConnected}
                        style={{ width: '100%' }}
                      >
                        {fc.busy ? (
                          <>
                            <div className="loading-spinner"></div>
                            点赞中...
                          </>
                        ) : (
                          <>
                            <Icons.Heart />
                            点赞 (需支付手续费)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 打赏 */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icons.Gift />
                    打赏动态
                  </h3>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                    <div className="input-group">
                      <label className="label">动态 ID</label>
                      <input 
                        className="input" 
                        placeholder="输入动态 ID" 
                        value={postId} 
                        onChange={(e) => setPostId(e.target.value)} 
                      />
                    </div>
                    <div className="input-group">
                      <label className="label">打赏金额 (wei)</label>
                      <input 
                        className="input" 
                        placeholder="输入金额" 
                        value={tipWei} 
                        onChange={(e) => setTipWei(e.target.value)} 
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => fc.tip(BigInt(postId || "1"), BigInt(tipWei || "0"))} 
                        disabled={fc.busy || !isConnected}
                        style={{ width: '100%' }}
                      >
                        {fc.busy ? (
                          <>
                            <div className="loading-spinner"></div>
                            打赏中...
                          </>
                        ) : (
                          <>
                            <Icons.Gift />
                            打赏
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 解密统计 */}
              <div className="card">
                <div className="card-header">
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icons.Eye />
                    查看统计数据
                  </h3>
                </div>
                <div className="card-body">
                  <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                    <div className="input-group">
                      <label className="label">动态 ID</label>
                      <input 
                        className="input" 
                        placeholder="输入动态 ID" 
                        value={postId} 
                        onChange={(e) => setPostId(e.target.value)} 
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'end' }}>
                      <button 
                        className="btn btn-outline" 
                        onClick={async () => setStats(await fc.decryptPostStats(BigInt(postId || "1")))} 
                        disabled={fc.busy || !isConnected}
                        style={{ width: '100%' }}
                      >
                        {fc.busy ? (
                          <>
                            <div className="loading-spinner"></div>
                            解密中...
                          </>
                        ) : (
                          <>
                            <Icons.Eye />
                            解密统计
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  {(stats.likes > 0n || stats.tips > 0n) && (
                    <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                      <div style={{ display: 'flex', gap: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Icons.Heart />
                          <span>点赞数: {stats.likes.toString()}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Icons.Gift />
                          <span>打赏总额: {stats.tips.toString()} wei</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 朋友圈动态 */}
          {activeTab === 'posts' && (
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Icons.Eye />
                    朋友圈动态
                  </h3>
                  <button 
                    className="btn btn-secondary" 
                    onClick={refreshAllPosts} 
                    disabled={loadingPosts || !isConnected}
                  >
                    {loadingPosts ? (
                      <>
                        <div className="loading-spinner"></div>
                        加载中...
                      </>
                    ) : (
                      <>
                        <Icons.Refresh />
                        刷新
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="card-body">
                {allPosts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                    <p>还没有动态，快来发布第一条吧！</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {allPosts.slice().reverse().map((post) => (
                      <div key={post.id} className="post-card">
                        <div className="post-header">
                          <div className="post-id">#{post.id}</div>
                          <div className="post-time" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Icons.Clock />
                            {new Date(post.timestamp * 1000).toLocaleString()}
                          </div>
                        </div>
                        <div className="post-content">
                          <div className="post-author" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Icons.User />
                            {post.author.slice(0, 6)}...{post.author.slice(-4)}
                          </div>
                          <div className="post-text">
                            {post.text || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>无文字内容</span>}
                          </div>
                          {post.ipfsHash && (
                            <div className="post-ipfs">
                              📎 IPFS: {post.ipfsHash}
                            </div>
                          )}
                        </div>
                        <div className="post-actions" style={{ marginTop: '0.75rem', display: 'grid', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button 
                              className="btn btn-success"
                              onClick={() => fc.like(BigInt(post.id))}
                              disabled={fc.busy || !isConnected}
                            >
                              <Icons.Heart />
                              点赞
                            </button>
                            <input 
                              className="input" 
                              placeholder="打赏金额(wei)"
                              value={tipInputs[post.id] ?? ''}
                              onChange={(e) => setTipInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                              style={{ maxWidth: '220px' }}
                            />
                            <button 
                              className="btn btn-primary"
                              onClick={() => fc.tip(BigInt(post.id), BigInt((tipInputs[post.id] ?? '0') || '0'))}
                              disabled={fc.busy || !isConnected}
                            >
                              <Icons.Gift />
                              打赏
                            </button>
                            <button 
                              className="btn btn-secondary"
                              onClick={() => fc.grantDecryptForPost(BigInt(post.id))}
                              disabled={fc.busy || !isConnected}
                            >
                              申请解密权限
                            </button>
                            <button 
                              className="btn btn-outline"
                              onClick={async () => {
                                const res = await fc.decryptPostStats(BigInt(post.id));
                                setDecStatsByPost((prev) => ({ ...prev, [post.id]: res }));
                              }}
                              disabled={fc.busy || !isConnected}
                            >
                              <Icons.Eye />
                              解密统计
                            </button>
                          </div>
                          {decStatsByPost[post.id] && (
                            <div style={{ color: 'var(--text-secondary)' }}>
                              点赞数: {decStatsByPost[post.id].likes.toString()} ，打赏总额: {decStatsByPost[post.id].tips.toString()} wei
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 连接提示 */}
        {!isConnected && (
          <div className="card" style={{ marginTop: '2rem' }}>
            <div className="card-body" style={{ textAlign: 'center', padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🔌</div>
              <h3 style={{ color: 'var(--text-secondary)' }}>请连接钱包</h3>
              <p style={{ color: 'var(--text-muted)' }}>需要连接以太坊钱包才能使用朋友圈功能</p>
              {!isWalletConnected && (
                <button className="btn btn-primary" onClick={connectWallet} disabled={!hasWallet}>
                  连接钱包
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


