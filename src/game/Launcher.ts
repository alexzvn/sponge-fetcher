import fetch from "node-fetch"
import { platform } from "process"
import { FileSystemAdapter, PathAdapter, Platform } from "~/types/Adapter"
import { LibraryDownloadInterface, LibraryInterface, PackageManifestInterface } from "~/types/GameData"
import NodePathAdapter from "~/utils/NodePathAdapter"
import NodeFileAdapter from '~/utils/NodeFileAdapter'
import { createComparator, normalize } from "~/utils/os"
import unzipper from "~/utils/UnzipperAdapter"
import { nativePlatformConverter, shouldPrepareLibrary } from "./Downloader"

export interface Player {
  uuid: string
  username: string
  access_token: string
  auth_type: 'msa'|'mojang'
}

export interface JavaConfig {

  /**
   * version of minecraft
   */
  id: string

  resolution?: {
    width: string|number
    height: string|number
  }

  directory: string
  natives_directory: string
  libraries: string[]
  version_type: 'release'|'snapshot'
  fullscreen?: boolean
  main_class: string

  asset: {
    version: string
    path: string
  }
}

export interface StartupOptions {
  java: JavaConfig,
  player: Player,
  launcher: {
    name: string
    version: string
  },
  ram: {
    max: string
    min: string
  },
  brand?: {
    name: string
    icon: string
  }

  platform: Platform
}

export interface LauncherOptions {
  player: Player,
  launcher: {
    name: string
    version: string
  },

  ram: {
    max: string
    min: string
  }

  brand?: {
    name: string
    icon: string
  }
}

const checkJvmRule = (action: string, current: Platform, os?: any) => {
  if (! os.name) return action === 'allow'

  if (os.arch) return false

  const isSame = current === normalize(os.name)

  return (action === 'allow' && isSame) || (action === 'disallow' && !isSame)
}

export const buildArguments = (manifest: PackageManifestInterface, options: StartupOptions) => {
  const discovery = /\${*(.*)}/
  const { game, jvm } = manifest.arguments
  const { player, java, launcher } = options

  const args = {
    jvm: [] as string[],
    game: [] as string[]
  }

  const identify = {
    auth_player_name: player.username,
    auth_uuid: player.uuid,
    auth_access_token: player.access_token,
    user_type: player.auth_type,

    launcher_name: launcher.name,
    launcher_version: launcher.version,

    version_name: java.id,
    version_type: java.version_type,
    game_directory: java.directory,
    assets_root: java.asset.path,
    assets_index_name: java.asset.version,
    width: java.resolution?.width,
    resolution_height: java.resolution?.height,
    main_class: java.main_class,
    natives_directory: java.natives_directory, // folder that extract native libraries
    classpath: java.libraries.join(platform === 'win32' ? ';' : ':') // jar files
  } as any

  for (const arg of jvm) {
    if (typeof arg === 'string') {
      args.jvm.push(arg)
      continue
    }

    for (const rule of arg.rules) {
      if (checkJvmRule(rule.action, options.platform, rule.os) === false) continue

      if (typeof arg.value === 'string') {
        args.jvm.push(arg.value)
        continue
      }

      args.jvm.push(...arg.value)
    }
  }

  for (const arg of game) {
    if (typeof arg === 'string') {
      args.game.push(arg)
    }
  }

  const replacer = (content: string) => {
    const match = discovery.exec(content)

    if (! match) return content

    const key = match[1]

    if (! identify[key]) return content

    return content.replace(discovery, identify[key])
  }

  args.game.unshift(identify.main_class)

  args.jvm.unshift(
    '-Xms' + options.ram.min,
    '-Xmx' + options.ram.max,
    // '-XX:+UnlockExperimentalVMOptions',
    // '-XX:+UseG1GC',
    // '-XX:G1NewSizePercent=20',
    // '-XX:G1ReservePercent=20',
    // '-XX:MaxGCPauseMillis=50',
    // '-XX:G1HeapRegionSize=32M',
    // '-Dfml.ignorePatchDiscrepancies=true',
  )

  if (options.brand) {
    args.jvm.push(
      '-Xdock:name=' + options.brand.name,
      '-Xdock:icon=' + options.brand.icon
    )
  }

  return {
    jvm: args.jvm.map(replacer),
    game: args.game.map(replacer)
  }
}

const randomId = () => Math.random().toString(36).substring(2, 15)

export default class Launcher {

  protected path: PathAdapter = NodePathAdapter
  protected fetch = fetch
  protected fs: FileSystemAdapter = NodeFileAdapter
  protected unzipper = unzipper
  protected id = randomId()

  protected libraries = [] as LibraryInterface[]

  constructor(
    public readonly workingDir: string,
    public readonly manifest: PackageManifestInterface,
    public readonly platform: Platform
  ) {
    const isPlatform = createComparator(this.platform)

    for (const library of this.manifest.libraries) {
      if (shouldPrepareLibrary(library, isPlatform) === false) continue
      this.libraries.push(library)
    }
  }

  public async launch(options: LauncherOptions) {
    await this.extractLibraries()

    let libs = await Promise.all(this.libraries.map(lib => this.path.join(this.workingDir, 'libraries', lib.downloads.artifact.path)))

    libs.push(await this.path.join(this.workingDir, 'versions', this.manifest.id, this.manifest.id + '.jar'))

    libs = [... new Set(libs)]

    return buildArguments(this.manifest, {
      ...options,
      platform: this.platform,
      java: {
        id: this.manifest.id,
        asset: { path: await this.path.join(this.workingDir, 'assets'), version: this.manifest.assetIndex.id },
        natives_directory: await this.path.join(this.workingDir, 'bin', this.id),
        libraries: libs,
        directory: await this.path.join(this.workingDir),
        version_type: this.manifest.type,
        main_class: this.manifest.mainClass,
      }
    })
  }

  public async clean() {
    await this.fs.removeDir(
      await this.path.join(this.workingDir, 'bin', this.id),
    )

    this.regenerate()
  }

  protected async extractLibraries() {
    const key = nativePlatformConverter(this.platform)

    for (const { downloads } of this.libraries) {
      if (! downloads.classifiers || !downloads.classifiers[key]) continue

      const native = downloads.classifiers[key]!

      await this.unzipper(
        await this.path.join(this.workingDir, 'libraries', native.path),
        await this.path.join(this.workingDir, 'bin', this.id)
      )
    }
  }

  private regenerate() {
    this.id = randomId()
  }
}
