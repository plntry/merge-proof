import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MergeProof — Pull Request Analysis",
  description: "Evidence-based pull request analysis with human review and deterministic merge decisions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
