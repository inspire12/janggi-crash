import type { Metadata } from 'next';
import { Geist_Mono, Noto_Sans_KR, Noto_Serif_KR } from 'next/font/google';
import './globals.css';

const notoSansKr = Noto_Sans_KR({
  variable: '--font-noto-sans-kr',
  subsets: ['latin'],
  display: 'swap',
});

const notoSerifKr = Noto_Serif_KR({
  variable: '--font-noto-serif-kr',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '장기: 격돌 — 연출 프로토타입',
  description: '기물의 타격감과 시네마틱 연출을 실험하는 한국 장기 웹 프로토타입',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${notoSansKr.variable} ${notoSerifKr.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
