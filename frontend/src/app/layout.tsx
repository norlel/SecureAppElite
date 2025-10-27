import './globals.css';
import type { Viewport } from 'next';

export const metadata = {
  title: 'FriendCircle - 隐私朋友圈',
  description: '基于 FHEVM 的隐私保护朋友圈应用，支持加密点赞和打赏',
  keywords: 'FHEVM, 区块链, 隐私, 朋友圈, 加密',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content="#6366f1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌟</text></svg>" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}


