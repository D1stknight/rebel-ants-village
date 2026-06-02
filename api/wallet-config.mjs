export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // WalletConnect project IDs are public client configuration, not secrets.
  // Add WALLETCONNECT_PROJECT_ID in Vercel to enable the mobile QR wallet flow.
  res.status(200).json({
    walletConnectProjectId:
      process.env.WALLETCONNECT_PROJECT_ID ||
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
      ''
  });
}
