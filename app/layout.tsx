import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:5173";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;

  return {
    title: "안심 로그인 · HTML 화면 목업",
    description: "로그인, 회원가입, 이메일 OTP, 계정 복구와 보안 활동을 체험하는 인터랙티브 UI 목업",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "안심 로그인",
      description: "안전함은 복잡하지 않아야 하니까",
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1672, height: 941, alt: "안심 로그인 HTML UI 목업" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "안심 로그인",
      description: "안전함은 복잡하지 않아야 하니까",
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
