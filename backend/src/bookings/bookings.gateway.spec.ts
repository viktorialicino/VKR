import type { Socket } from 'socket.io';
import { BookingsGateway } from './bookings.gateway.js';

// Подменяем сервер Socket.IO: проверяем, в какой канал и какое событие отправляет шлюз
function gatewayWithFakeServer() {
  const emit = vi.fn();
  const to = vi.fn().mockReturnValue({ emit });
  const gateway = new BookingsGateway();
  (gateway as unknown as { server: unknown }).server = { to };
  return { gateway, to, emit };
}

const fakeClient = () => ({ join: vi.fn(), leave: vi.fn() }) as unknown as Socket & { join: any; leave: any };

describe('BookingsGateway', () => {
  it('подписывает клиента на канал комнаты и отписывает от него', () => {
    const { gateway } = gatewayWithFakeServer();
    const client = fakeClient();
    expect(gateway.subscribe('room-1', client)).toEqual({ ok: true });
    expect(client.join).toHaveBeenCalledWith('room:room-1');
    expect(gateway.unsubscribe('room-1', client)).toEqual({ ok: true });
    expect(client.leave).toHaveBeenCalledWith('room:room-1');
  });

  it('отклоняет подписку с некорректным идентификатором комнаты', () => {
    const { gateway } = gatewayWithFakeServer();
    const client = fakeClient();
    expect(gateway.subscribe(42 as unknown as string, client)).toEqual({ ok: false });
    expect(client.join).not.toHaveBeenCalled();
  });

  it('рассылает booking:created только подписчикам канала своей комнаты', () => {
    const { gateway, to, emit } = gatewayWithFakeServer();
    const booking = { roomId: 'room-1', id: 'b1' };
    gateway.emitCreated(booking);
    expect(to).toHaveBeenCalledWith('room:room-1');
    expect(emit).toHaveBeenCalledWith('booking:created', booking);
  });

  it('рассылает booking:cancelled при отмене брони', () => {
    const { gateway, to, emit } = gatewayWithFakeServer();
    const booking = { roomId: 'room-2', id: 'b2' };
    gateway.emitCancelled(booking);
    expect(to).toHaveBeenCalledWith('room:room-2');
    expect(emit).toHaveBeenCalledWith('booking:cancelled', booking);
  });

  it('рассылает booking:updated при изменении брони', () => {
    const { gateway, to, emit } = gatewayWithFakeServer();
    const booking = { roomId: 'room-3', id: 'b3' };
    gateway.emitUpdated(booking);
    expect(to).toHaveBeenCalledWith('room:room-3');
    expect(emit).toHaveBeenCalledWith('booking:updated', booking);
  });
});
