import designTokensPkg from '@mindcalm/design-tokens'

const { createCssVariableBlock, designTokens } = designTokensPkg

export function injectDesignSystemTokens() {
  if (typeof document === 'undefined') {
    return
  }

  const styleId = 'mindcalm-admin-design-tokens'
  const existingStyle = document.getElementById(styleId)
  const css = createCssVariableBlock(':root', designTokens.themes.admin.light)

  if (existingStyle) {
    existingStyle.textContent = css
    return
  }

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = css
  document.head.appendChild(style)
}
