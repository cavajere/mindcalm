const designTokens = require('./tokens.json')

function hexToRgbChannels(hex) {
  const normalized = hex.replace('#', '')
  const segments = normalized.length === 3
    ? normalized.split('').map((segment) => segment + segment)
    : normalized.match(/.{1,2}/g)

  if (!segments || segments.length !== 3) {
    throw new Error(`Invalid hex color: ${hex}`)
  }

  return segments.map((segment) => String(Number.parseInt(segment, 16))).join(' ')
}

function createCssVariables(themeColors) {
  return {
    '--color-surface': hexToRgbChannels(themeColors.surface),
    '--color-background': hexToRgbChannels(themeColors.background),
    '--color-text-primary': hexToRgbChannels(themeColors.textPrimary),
    '--color-text-secondary': hexToRgbChannels(themeColors.textSecondary),
    '--color-border': hexToRgbChannels(themeColors.border),
    '--color-muted': hexToRgbChannels(themeColors.muted),
  }
}

function createCssVariableBlock(selector, themeColors) {
  const declarations = Object.entries(createCssVariables(themeColors))
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')

  return `${selector} { ${declarations} }`
}

const payload = {
  designTokens,
  hexToRgbChannels,
  createCssVariables,
  createCssVariableBlock,
}

module.exports = payload
module.exports.default = payload
