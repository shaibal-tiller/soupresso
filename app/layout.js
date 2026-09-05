import './globals.css';

export const metadata = {
  title: 'Soupresso — Daily Cash Register',
  description: 'Daily cash reconciliation, receipts, and sales dashboard for Soupresso — Soup, Momo & Fried Snacks at ECB Chattar, Dhaka Cantonment.',
  icons: { icon: '/logo.jpg', apple: '/logo.jpg' },
  openGraph: {
    title: 'Soupresso — Cash Register',
    description: 'Daily cash reconciliation & sales tracking for Soupresso',
    siteName: 'Soupresso',
    locale: 'en_US',
    type: 'website',
  },
  manifest: '/manifest.json',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#1F5C42',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
