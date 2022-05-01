import { writeFile, readFileSync, existsSync, stat, rmSync, rmdirSync, lstatSync, mkdirSync } from 'fs'
import { parse } from 'path'
import { FileSystemAdapter } from '~/types/Adapter'


const adapter: FileSystemAdapter = {
  async write(path: string, content: string|Buffer) {

    mkdirSync(parse(path).dir, { recursive: true })

    await new Promise((resolve, reject) => {
      writeFile(path, content, (err) => {
        if (err) reject(err)
        else resolve('done')
      })
    })
  },

  async read(path: string) {
    return readFileSync(path).toString('utf8')
  },

  async exists(path: string) {
    return new Promise((resolve, reject) => {
      stat(path, (err, stats) => {
        if (err) resolve(false)
        else resolve(true)
      })
    })
  },

  async isDir(path: string) {
    return lstatSync(path).isDirectory()
  },

  async remove(path: string) {
    return rmSync(path)
  },

  async removeDir(path: string) {
    return rmdirSync(path)
  }
}

export default adapter
