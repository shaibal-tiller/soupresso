import './globals.css';

export const metadata = {
  title: 'Soupresso — Cash Register',
  description: 'Daily cash reconciliation for Soupresso',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
