import fetch from 'node-fetch'
import mitt from 'mitt'
import NodeFileAdapter from '~/utils/NodeFileAdapter'
import NodePathAdapter from '~/utils/NodePathAdapter'
import { FetchAdapter, FileSystemAdapter, Platform, PathAdapter } from '~/types/Adapter'
import { LibraryInterface, PackageAssetObject, PackageManifestInterface } from '~/types/GameData'
import QueueStack from '~/utils/QueueStack'
import { createComparator } from '~/utils/os'

interface Progress {
  total: number
  loaded: number
  current: string
}

type Events = {
  progress: Progress
  error: any
  abort: void
  pause: void
  resume: void
  finish: void
};

type Downloadable = {
  name: string,
  url: string
  destination: string
}

const RESOURCE_ENDPOINT = 'https://resources.download.minecraft.net'

const ASSET_FOLDER = 'assets/objects'
const ASSET_INDEX_FOLDER = 'assets/indexes'
const ASSET_LOGGER_FOLDER = 'assets/log_configs'
const LIBRARY_FOLDER = 'libraries'

const shouldPrepareLibrary = (library: LibraryInterface, isPlatform: (os: string) => boolean) => {
  if (! library.rules) return true

  let shouldPrepare = false

  const isOkay = (action: string, os?: any) => {
    if (! os) return action === 'allow'

    const isSameOS = isPlatform(os.name)

    return (action === 'allow' && isSameOS) || (action === 'disallow' && !isSameOS)
  }

  for(const rule of library.rules) {
    shouldPrepare = isOkay(rule.action, rule.os)
  }

  return shouldPrepare
}

const nativePlatformConverter = (platform: Platform) => {
  if (platform === 'win32') return 'natives-windows'
  if (platform === 'darwin') return 'natives-macos'
  if (platform === 'linux') return 'natives-linux'

  throw new Error(`Unsupported platform: ${platform}`)
}

export default class Downloader {

  protected path: PathAdapter = NodePathAdapter
  protected fetch = fetch
  protected fs: FileSystemAdapter = NodeFileAdapter
  protected emitter = mitt<Events>()

  protected isRunning = false
  protected isDownloading = false
  protected total = 0
  protected loaded = 0

  protected items: Downloadable[] = []

  /**
   * Assets and libraries game downloader
   * 
   * @param workingDir Working folder like .minecraft folder
   * @param concurrent Download file concurrently count
   */
  constructor(
    protected readonly workingDir: string,
    public concurrent = 5,
    public readonly platform: Platform
  ) {}

  public useFetch(adapter: FetchAdapter) {
    this.fetch = adapter as any
  }

  public useFileSystem(adapter: FileSystemAdapter) {
    this.fs = adapter
  }

  public usePath(adapter: PathAdapter) {
    this.path = adapter
  }

  /**
   * Fetch assets information from manifest and prepare download list
   * 
   * @param manifest manifest of minecraft
   */
  protected async prepareAssets(manifest: PackageManifestInterface) {
    let objects: PackageAssetObject[]

    const index = await this.path.join(this.workingDir, ASSET_INDEX_FOLDER, manifest.assetIndex.id + '.json')

    if (await this.fs.exists(index) === false) {
      const response = await (await this.fetch(manifest.assetIndex.url)).text()

      await this.fs.write(index, response)

      objects = JSON.parse(response).objects
    }

    objects = objects! || JSON.parse(await this.fs.read(index)).objects

    for (const key in objects) {
      const asset = objects[key]

      const hex = asset.hash[0] + asset.hash[1]

      this.items.push({
        name: key,
        url: `${RESOURCE_ENDPOINT}/${hex}/${asset.hash}`,
        destination: await this.path.join(this.workingDir, ASSET_FOLDER, hex, asset.hash)
      })
    }
  }

  /**
   * Prepare libraries for game before download
   * 
   * @param manifest manifest of minecraft
   */
  protected async prepareLibraries(manifest: PackageManifestInterface) {

    const libraries = manifest.libraries
    const nativePlatform = nativePlatformConverter(this.platform)
    const isPlatform = createComparator(this.platform)

    for (const library of libraries) {
      if (! shouldPrepareLibrary(library, isPlatform)) continue

      this.items.push({
        name: library.downloads.artifact.path,
        url: library.downloads.artifact.url,
        destination: await this.path.join(this.workingDir, LIBRARY_FOLDER, library.downloads.artifact.path),
      })

      if (! library.downloads.classifiers|| ! library.downloads.classifiers[nativePlatform]) continue

      const native = library.downloads.classifiers[nativePlatform]!

      this.items.push({
        name: native.path,
        url: native.url,
        destination: await this.path.join(this.workingDir, LIBRARY_FOLDER, native.path),
      })
    }
  }

    /**
   * Prepare log settings for game before download
   * 
   * @param manifest manifest of minecraft
   */
  protected async prepareLoggings(manifest: PackageManifestInterface) {
    const loggings = manifest.logging

    if (!loggings) return

    this.items.push({
      name: loggings.client.file.id,
      url: loggings.client.file.url,
      destination: await this.path.join(this.workingDir, ASSET_LOGGER_FOLDER, loggings.client.file.id)
    })
  }

  protected async filterExistsDownloadable() {
    const exists = await Promise.all(this.items.map(async item => {
      return await this.fs.exists(item.destination)
    }))

    this.items = this.items.filter((_, i) => exists[i] === false)
  }

  public async download(manifest: PackageManifestInterface) {
    if (this.isDownloading) return
    this.isDownloading = true

    await Promise.all([
      this.prepareAssets(manifest),
      this.prepareLibraries(manifest),
      this.prepareLoggings(manifest)
    ])

    await this.filterExistsDownloadable()

    this.total = this.items.length

    await this.run()

    this.isDownloading = false

    if (this.items.length === 0) {
      this.reset()
      this.emitter.emit('finish')
    }
  }

  protected async run() {
    if (this.isRunning) return

    this.isRunning = true

    try {
      const check = () => this.isDownloading

      await QueueStack(this.items, 20, async (item: Downloadable) => {
        if (!check()) return
  
        const response  = await this.fetch(item.url)
        const content = await response.buffer()
  
        await this.fs.write(item.destination, content)
  
        this.emitter.emit('progress', {
          total: this.total,
          loaded: ++this.loaded,
          current: item.name
        })
      })
    } catch (error) {
      this.emitter.emit('error', error)
    }

    this.isRunning = false
  }

  public abort() {
    this.reset()
    this.emitter.emit('abort')
  }

  public onProgress(cb: (progress: Progress) => any) {
    this.emitter.on('progress', cb)
  }

  public onError(cb: (error: any) => any) {
    this.emitter.on('error', cb)
  }

  public onAbort(cb: () => any) {
    this.emitter.on('abort', cb)
  }

  public onFinish(cb: () => any) {
    this.emitter.on('finish', cb)
  }

  protected reset() {
    this.isDownloading = false
    this.items = []
    this.total = 0
    this.loaded = 0
  }
}
