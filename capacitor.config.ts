import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.boardsim.app',
  appName: 'Board Sim',
  webDir: 'dist',
  server: {
    // Load from bundled assets in production WebView (not a remote URL)
    androidScheme: 'https',
  },
  android: {
    // Tablet-first training app — allow mixed content only if needed later
    allowMixedContent: false,
    backgroundColor: '#0f1419',
  },
  ios: {
    // Prefer landscape-capable tablet layout; content inset for status bar
    contentInset: 'automatic',
    backgroundColor: '#0f1419',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: '#0f1419',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f1419',
    },
  },
}

export default config
