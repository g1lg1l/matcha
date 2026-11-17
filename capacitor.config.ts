import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.github.g1lg1l.matcha',
  appName: 'Matcha',
  webDir: 'dist',
  backgroundColor: '#000000',
  android: { backgroundColor: '#000000' },
  ios: { backgroundColor: '#000000', contentInset: 'never' },
}

export default config
