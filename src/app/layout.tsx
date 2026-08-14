import type { ReactNode } from "react";
import "./globals.css";
import "./../styles/variables.css";
import SiteHeader from "../components/SiteHeader";
import Footer from "@/components/Footer";
import AnalyticsConsent from "@/components/AnalyticsConsent";
import { DEFAULT_SITE_METADATA } from "@/lib/publicSiteMetadata";

export const metadata = DEFAULT_SITE_METADATA;

export default function RootLayout({
	children,
}: Readonly<{
	children: ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="antialiased">
				<AnalyticsConsent />
				{/* Header: visitor vs member */}
				<SiteHeader />
				{/* Offset for sticky controls */}
				<div className="topWhitespace" />
				{children}
				<Footer />
			</body>
		</html>
	);
}
