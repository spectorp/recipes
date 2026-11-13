import { boot } from './shell/local'

await boot()

const { mountApp } = await import('./mount.tsx')
mountApp()
