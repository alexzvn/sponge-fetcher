import unzip from 'unzipper'
import { UnzipAdapter } from '~/types/Adapter'

const unzipper: UnzipAdapter = (filepath: string, destination: string) => {
  return unzip.Open.file(filepath).then(d => {
    d.extract({ path: destination })
  })
}

export default unzipper
