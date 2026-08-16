import { readFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

const PACKAGE_ID = 'dsh-session-attention'
const PACKAGE_ROOT = import.meta.dirname
const CSS_PREFIX = '\0session-attention-css:'
const CSS_SUFFIX = '.mjs'
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
]

const library: UserConfig = {
  name: PACKAGE_ID,
  entry: ['lib/types/index.js', 'lib/types/invariant.js'],
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
  deps: { neverBundle: [/^@deepseek-ai\//] },
}

const client: UserConfig = {
  name: `${PACKAGE_ID}/client`,
  entry: { client: 'lib/types/client/index.js' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  target: 'es2024',
  dts: false,
  sourcemap: true,
  clean: false,
  deps: {
    neverBundle: CLIENT_EXTERNALS,
    alwaysBundle: [/.*/],
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  plugins: [{
    name: 'session-attention-client-purity',
    resolveId(source: string) {
      if (!source.startsWith('@deepseek-ai/')) return null
      if (CLIENT_EXTERNALS.includes(source)) return null
      throw new Error(`client bundle cannot import runtime value ${JSON.stringify(source)}`)
    },
  }, {
    name: 'session-attention-css-modules',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css') || importer === undefined) return null
      const emittedPath = resolve(dirname(importer), source)
      const packagePath = relative(PACKAGE_ROOT, emittedPath).split(sep).join('/')
      return `${CSS_PREFIX}${packagePath}${CSS_SUFFIX}`
    },
    async load(id: string) {
      if (!id.startsWith(CSS_PREFIX)) return null
      const packagePath = id.slice(CSS_PREFIX.length, -CSS_SUFFIX.length)
      const marker = 'lib/types/'
      const sourcePath = resolve(PACKAGE_ROOT, packagePath.startsWith(marker)
        ? `src/${packagePath.slice(marker.length)}`
        : packagePath)
      this.addWatchFile(sourcePath)
      const result = transform({
        filename: sourcePath,
        code: await readFile(sourcePath),
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classes: Record<string, string> = {}
      for (const [local, value] of Object.entries(result.exports ?? {})) classes[local] = value.name
      const styleId = `${PACKAGE_ID}/${basename(sourcePath)}`
      return [
        `const css = ${JSON.stringify(result.code.toString())};`,
        `const styleId = ${JSON.stringify(styleId)};`,
        "if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(styleId) + ']') === null) {",
        "  const style = document.createElement('style');",
        `  style.dataset.plugin = ${JSON.stringify(PACKAGE_ID)};`,
        '  style.dataset.pluginCss = styleId;',
        '  style.textContent = css;',
        '  document.head.appendChild(style);',
        '}',
        `export default ${JSON.stringify(classes)};`,
      ].join('\n')
    },
  }],
  outputOptions: {
    entryFileNames: 'client.cjs',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [library, client]
