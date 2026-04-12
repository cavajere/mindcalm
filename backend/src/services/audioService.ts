export async function getAudioDuration(filePath: string): Promise<number> {
  const mm = await (eval('import("music-metadata")') as Promise<typeof import('music-metadata')>)
  const metadata = await mm.parseFile(filePath)
  return Math.round(metadata.format.duration || 0)
}

export function getAudioFormat(mimetype: string): string {
  const formats: Record<string, string> = {
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
  }
  return formats[mimetype] || 'mp3'
}
