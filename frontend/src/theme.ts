import { createTheme } from '@mui/material/styles'
import type {} from '@mui/x-date-pickers/themeAugmentation'

export const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: '#4f46e5', light: '#818cf8', dark: '#3730a3', contrastText: '#ffffff' },
    secondary: { main: '#0ea5e9' },
    success: { main: '#16a34a' },
    error: { main: '#dc2626' },
    background: { default: '#f4f5fb', paper: '#ffffff' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    divider: '#e6e8f1',
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    h5: { fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 12 } },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 22, '&.MuiDialog-paperFullScreen': { borderRadius: 0 } },
      },
    },
    MuiToggleButton: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, borderRadius: 10, paddingInline: 14 },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 12, backgroundColor: '#fff' } } },
    MuiPickerPopper: {
      styleOverrides: {
        paper: { borderRadius: 16, border: '1px solid #e6e8f1', boxShadow: '0 12px 32px rgba(15,23,42,.14)', marginTop: 6 },
      },
    },
    MuiPickerDay: { styleOverrides: { root: { fontWeight: 500 } } },
  },
})
