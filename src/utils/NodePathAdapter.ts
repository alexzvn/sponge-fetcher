import { PathAdapter } from '~/types/Adapter';
import { join } from 'path'

export default {
  async join(...path: string[]): Promise<string> {
    return join(...path)
  }
} as PathAdapter
