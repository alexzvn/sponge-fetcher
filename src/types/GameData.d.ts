export interface AssetObjectInfo {
  objects: {
    /**
     * Key is the path and filename of the object
     */
    [key: string]: { hash: string, size: number }
  }
}

export interface PackageAssetObject {
  hash: string
  size: number
}

export interface BuildVersionInterface {
  /**
   * version tag e.g 1.17.2
   */
  id: string
  type: 'release' | 'snapshot'

  /**
   * Package json manifest url
   */
  url: string
  time: string
  releaseTime: string
}

export interface GameVersionInterface {
  latest: { release: string, snapshot: string },

  version: BuildVersionInterface[]
}

export type ArgumentRule = {
  action: string
  [key: string]: any|unknown
}

export type Argument = string | {
  rules: ArgumentRule[]
  value: string | string[]
}

export interface DownloadManifestInterface {
  sha1: string
  url: string
  size: number
}

export interface AssetIndexInterface extends DownloadManifestInterface {
  id: string
  totalSize: number

  /**
   * Link to json file
   */
  url: string
} 

export interface LibraryManifestInterface extends DownloadManifestInterface {
  /**
   * Relative path to game data
   */
  path: string
}

export interface LibraryDownloadInterface {
  path: string
  sha1: string
  size: number
  url: string
}

export interface LibraryInterface {
  downloads: {
    artifact: LibraryDownloadInterface

    classifiers?: {
      javadoc?: LibraryDownloadInterface
      'natives-linux'?: LibraryDownloadInterface
      'natives-windows'?: LibraryDownloadInterface
      'natives-macos'?: LibraryDownloadInterface
      source?: LibraryDownloadInterface
    }
  }

  natives?: {
    linux?: 'natives-linux'
    windows?: 'native-windows'
  }

  name: string
  rules?: ArgumentRule[]
}

export interface PackageManifestInterface {
  id: string

  arguments: {
    game: Argument[]
    jvm: Argument[]
  }

  assetIndex: AssetIndexInterface
  assets: string
  complianceLevel: number

  downloads: {
    client: DownloadManifestInterface,
    client_mappings: DownloadManifestInterface
    server: DownloadManifestInterface
    server_mappings: DownloadManifestInterface
  }

  libraries: LibraryInterface[]

  javaVersion: {
    component: string
    majorVersion: number
  }

  logging: {
    client: {
      argument: string
      file: { id: string, sha1: string, size: number, url: string }
      type: string
    }
  }

  mainClass: string
  minimumLauncherVersion: number
  releaseTime: string
  time: string
  type: 'release' | 'snapshot'
}

