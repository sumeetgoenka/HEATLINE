import './globals.css';

export const metadata = {
  title: 'HEATLINE',
  description: 'Open-world chase sandbox built with Three.js and Next.js'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
