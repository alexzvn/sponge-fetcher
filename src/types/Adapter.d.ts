interface Response {
  status: number
  success: boolean
  text(): Promise<string>
  json(): Promise<any>
}

export interface FetchAdapter {
  (url: string, options?: object): Promise<Response>
}

export interface PathAdapter {
  join(...path: string[]): Promise<string>
}

export interface FileSystemAdapter {
  /**
   * Asynchronously writes data to a file, replacing the file if it already exists.
   */
  write(path: string, content: string|Buffer): Promise<void>
  read(path: string): Promise<string>

  /**
   * 
   * @param path path to the file/dir
   */
  exists(path: string): Promise<boolean>

  isDir(path: string): Promise<boolean>
  remove(path: string): Promise<void>
  removeDir(path: string): Promise<void>
}

export interface ExtractorAdapter {
  (content: string): Promise<string>
}
