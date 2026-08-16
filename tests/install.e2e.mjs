import { execFile, spawn } from 'node:child_process'
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'

const exec = promisify(execFile)
const root = resolve(import.meta.dirname, '..')
const work = await mkdtemp(join(tmpdir(), 'dsh-session-attention-install-'))
const packDir = join(work, 'pack')
const home = join(work, 'home')
const prefix = join(work, 'dsh')
const dshVersion = process.env.DSH_VERSION ?? '0.1.0-rc.6'

try {
  await mkdir(packDir)
  const packed = await exec('pnpm', ['pack', '--pack-destination', packDir], { cwd: root })
  const tarball = resolve(packDir, packed.stdout.trim().split('\n').at(-1))
  await exec('npm', ['install', '--prefix', prefix, `@deepseek-ai/dsh@${dshVersion}`], {
    cwd: root,
    timeout: 600_000,
  })
  const dsh = join(prefix, 'node_modules', '.bin', 'dsh')
  const env = { ...process.env, DSH_HOME: home }
  await exec(dsh, ['plugin', '--profile', 'web', 'add', tarball], {
    cwd: root,
    env,
    timeout: 600_000,
  })

  const profile = JSON.parse(await readFile(join(home, 'profiles', 'web', 'package.json'), 'utf8'))
  if (profile.dependencies?.['dsh-session-attention'] === undefined) {
    throw new Error('installed profile does not depend on dsh-session-attention')
  }
  if (!profile.dsh?.profile?.bundles?.includes('dsh-session-attention')) {
    throw new Error('installed profile did not activate the session attention bundle')
  }
  const dumped = await exec(dsh, ['--profile', 'web', '--dump-config'], {
    cwd: root,
    env,
    timeout: 600_000,
  })
  if (!dumped.stdout.includes('id: session-attention')
    || !dumped.stdout.includes('name: dsh-session-attention')) {
    throw new Error('composed profile does not contain the session attention row')
  }

  const server = spawn(dsh, ['web', '--port', '0'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
  try {
    const url = await waitForUrl(server)
    const html = await fetch(url).then(assertOk)
    if (!html.includes('dsh-session-attention')) {
      throw new Error('web boot manifest does not contain dsh-session-attention')
    }
    const bundle = await fetch(new URL('/plugins/dsh-session-attention/client.js', url)).then(assertOk)
    if (!bundle.includes('window.__ModuleLoader__.load') || !bundle.includes('dsh-session-attention')) {
      throw new Error('web server did not serve the DSH client bundle')
    }
  } finally {
    server.kill('SIGTERM')
    await Promise.race([
      new Promise(resolveExit => server.once('exit', resolveExit)),
      new Promise(resolveTimeout => setTimeout(resolveTimeout, 5_000)),
    ])
  }

  console.log(`install smoke passed against @deepseek-ai/dsh@${dshVersion}`)
} finally {
  await rm(work, { recursive: true, force: true })
}

async function assertOk(response) {
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${response.url}`)
  return response.text()
}

function waitForUrl(server) {
  return new Promise((resolveUrl, rejectUrl) => {
    let output = ''
    const timer = setTimeout(() => {
      server.kill('SIGTERM')
      rejectUrl(new Error(`web server did not publish a URL:\n${output}`))
    }, 60_000)
    const inspect = chunk => {
      output += chunk.toString()
      const match = /https?:\/\/[^\s]+/.exec(output)
      if (match === null) return
      clearTimeout(timer)
      resolveUrl(match[0])
    }
    server.stdout.on('data', inspect)
    server.stderr.on('data', inspect)
    server.once('exit', code => {
      clearTimeout(timer)
      rejectUrl(new Error(`web server exited with ${code}:\n${output}`))
    })
  })
}
