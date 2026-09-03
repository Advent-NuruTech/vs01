import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./about-image.css";

export const metadata: Metadata = { title: "Vitour Xpress | The Tyre Experts", description: "Quality tyres, expert fitting and automotive care in Kenya." };

export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="en"><body>{children}</body></html>; }
