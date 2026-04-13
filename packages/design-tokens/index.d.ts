export interface ColorScale {
  DEFAULT: string
  light: string
  dark: string
}

export interface ThemeSurfaceColors {
  surface: string
  background: string
  textPrimary: string
  textSecondary: string
  border: string
  muted: string
}

export interface DesignTokens {
  typography: {
    fontFamilySans: string[]
  }
  brand: {
    primary: ColorScale
    secondary: ColorScale
    accent: ColorScale
  }
  themes: {
    frontend: {
      light: ThemeSurfaceColors
      dark: ThemeSurfaceColors
    }
    admin: {
      light: ThemeSurfaceColors
    }
  }
}

export interface DesignTokensModule {
  designTokens: DesignTokens
  hexToRgbChannels(hex: string): string
  createCssVariables(themeColors: ThemeSurfaceColors): Record<string, string>
  createCssVariableBlock(selector: string, themeColors: ThemeSurfaceColors): string
}

declare const payload: DesignTokensModule

export const designTokens: DesignTokens
export function hexToRgbChannels(hex: string): string
export function createCssVariables(themeColors: ThemeSurfaceColors): Record<string, string>
export function createCssVariableBlock(selector: string, themeColors: ThemeSurfaceColors): string
export default payload
