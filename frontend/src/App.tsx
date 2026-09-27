import EventAvailableIcon from '@mui/icons-material/EventAvailable'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import PersonIcon from '@mui/icons-material/Person'
import {
  AppBar,
  Box,
  Chip,
  Container,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { BookingCalendar } from './features/bookings/BookingCalendar'
import { useGetRoomsQuery, useGetUsersQuery } from './shared/api/api'
import { useRoomEvents } from './shared/socket/useRoomEvents'

export default function App() {
  const { data: rooms = [] } = useGetRoomsQuery()
  const { data: users = [] } = useGetUsersQuery()
  const [pickedRoom, setPickedRoom] = useState<string | null>(null)
  const [pickedUser, setPickedUser] = useState<string | null>(null)

  // до выбора берём первые значения из справочников
  const roomId = pickedRoom ?? rooms[0]?.id ?? null
  const userId = pickedUser ?? users[0]?.id ?? null

  const live = useRoomEvents(roomId)
  const room = rooms.find((r) => r.id === roomId)

  return (
    <Box sx={{ minHeight: '100vh', pb: { xs: 10, sm: 4 } }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ bgcolor: '#ffffff', borderBottom: 1, borderColor: 'divider' }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: { xs: 56, sm: 64 } }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: 'linear-gradient(135deg,#6366f1,#4338ca)',
              boxShadow: '0 4px 12px rgba(79,70,229,.35)',
              flexShrink: 0,
            }}
          >
            <EventAvailableIcon fontSize="small" />
          </Box>
          <Typography variant="h6" component="h1" noWrap sx={{ flexGrow: 1, fontSize: { xs: '1rem', sm: '1.2rem' } }}>
            Переговорные
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={live ? 'success' : 'default'}
            label={live ? 'Онлайн' : 'Нет связи'}
            icon={
              <Box
                component="span"
                sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: live ? 'success.main' : 'text.disabled', ml: '8px !important' }}
              />
            }
            title={live ? 'Календарь обновляется в реальном времени' : 'Нет соединения с сервером'}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ pt: { xs: 2, sm: 3 }, px: { xs: 1.5, sm: 3 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2.5, alignItems: { md: 'center' } }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" component="h2">
              Календарь бронирования
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' } }}>
              Выберите время на календаре или нажмите «Новая бронь»
            </Typography>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              select
              size="small"
              label="Переговорная"
              value={roomId ?? ''}
              onChange={(e) => setPickedRoom(e.target.value)}
              sx={{ minWidth: { sm: 260 } }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><MeetingRoomIcon fontSize="small" /></InputAdornment> } }}
            >
              {rooms.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.name} · {r.floor} эт. · до {r.capacity} чел.
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Вы (пока без входа)"
              value={userId ?? ''}
              onChange={(e) => setPickedUser(e.target.value)}
              sx={{ minWidth: { sm: 220 } }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment> } }}
            >
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.fullName}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>

        <Paper variant="outlined" sx={{ borderRadius: '20px', overflow: 'hidden', boxShadow: '0 8px 30px rgba(15,23,42,.05)', borderColor: 'divider' }}>
          {room && userId ? (
            <BookingCalendar key={room.id} roomId={room.id} roomName={room.name} userId={userId} />
          ) : (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <Typography color="text.secondary">Загрузка…</Typography>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  )
}
