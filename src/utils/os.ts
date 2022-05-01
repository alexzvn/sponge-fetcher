import { Platform } from "~/types/Adapter";

export const normalize = (platform: string): Platform => {
  switch (true) {
    case /osx|darwin|mac/.test(platform): return 'darwin'
    case /win/.test(platform): return 'win32'
    case /linux/.test(platform): return 'linux'
  }

  throw new Error("Unsupported platform " + platform)
}

export const createComparator = (current: Platform) => {
  return (platform: string) => normalize(platform) === current;
}
