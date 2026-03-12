import "./globals.css";

export const metadata = {
  title: "GTS Tracking",
  description: "Realtime GPS tracking with safety workflow"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

