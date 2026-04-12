export const audioLevelLabels = {
  BEGINNER: 'Principiante',
  INTERMEDIATE: 'Intermedio',
  ADVANCED: 'Avanzato',
} as const

export const audioLevelOptions = Object.entries(audioLevelLabels).map(([value, label]) => ({
  value,
  label,
}))

export function getAudioLevelLabel(level: string) {
  return audioLevelLabels[level as keyof typeof audioLevelLabels] || level
}
