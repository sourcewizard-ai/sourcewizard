// Centralized font family configurations for the planner app

export const fonts = {
  // Main monospace font for retro UI elements
  mono: "var(--font-ishmeria), monospace",

  // System font for status stripe and modern UI elements - using 90s font
  system: "var(--font-90s), system-ui, -apple-system, sans-serif",

  // Code font for code blocks and syntax highlighting
  code: "var(--font-90s), 'Geist Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",

  // Header font for titles and headings
  header: "var(--font-vollkorn), monospace",

  // Logo font for branding and logos
  logo: "monospace",

  // TaskBar font for navigation buttons
  taskbar: "var(--font-90s), monospace",

  // Status stripe font for status indicators
  statusStripe: "var(--font-90s), system-ui, -apple-system, sans-serif",
};

// Font sizes for different font types
export const fontSizes = {
  // System font size (90s font) - used in status stripe and plan content
  system: "24px",

  // Monospace font size - used in retro UI elements, buttons, and window chrome
  mono: "24px",

  // Code font size - used in code blocks and syntax highlighting
  code: "0.875rem", // 14px

  // Inline code font size
  inlineCode: "0.875rem", // 14px

  // Header font sizes
  header: "36px",

  // Logo font size
  logo: "24px",

  // TaskBar font size
  taskbar: "16px",

  // Status stripe font size
  statusStripe: "24px",
};

// Legacy export for backwards compatibility
export const systemFontSize = fontSizes.system;

// Helper function to get font family style object
export const getFontStyle = (fontType: keyof typeof fonts) => ({
  fontFamily: fonts[fontType],
});

// Helper function to get complete font style (family + size)
export const getCompleteFontStyle = (fontType: keyof typeof fonts) => ({
  fontFamily: fonts[fontType],
  fontSize: fontSizes[fontType],
});
