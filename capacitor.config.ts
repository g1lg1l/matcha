import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.g1lg1l.matcha',
  appName: 'Matcha',
  webDir: 'dist',
  backgroundColor: '#eef2e5',
  android: { backgroundColor: '#eef2e5' },
  ios: { backgroundColor: '#eef2e5', contentInset: 'never' },
}

export default config
