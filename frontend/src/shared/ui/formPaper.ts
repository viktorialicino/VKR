import type { DialogProps } from '@mui/material'
import type { FormEvent } from 'react'

// Диалог-форма без встроенной проверки браузера: сообщения об ошибках показывает само приложение, на русском
export const formPaper = (onSubmit: (e: FormEvent) => void) =>
  ({ paper: { component: 'form', noValidate: true, onSubmit } }) as unknown as DialogProps['slotProps']
