import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

const roomChannel = (roomId: string) => `room:${roomId}`;

@WebSocketGateway({ cors: { origin: true } })
export class BookingsGateway {
  @WebSocketServer()
  private server!: Server;

  @SubscribeMessage('room:subscribe')
  subscribe(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    if (typeof roomId !== 'string') return { ok: false };
    void client.join(roomChannel(roomId));
    return { ok: true };
  }

  @SubscribeMessage('room:unsubscribe')
  unsubscribe(@MessageBody() roomId: string, @ConnectedSocket() client: Socket) {
    if (typeof roomId !== 'string') return { ok: false };
    void client.leave(roomChannel(roomId));
    return { ok: true };
  }

  emitCreated(booking: { roomId: string }) {
    this.server.to(roomChannel(booking.roomId)).emit('booking:created', booking);
  }

  emitUpdated(booking: { roomId: string }) {
    this.server.to(roomChannel(booking.roomId)).emit('booking:updated', booking);
  }

  emitCancelled(booking: { roomId: string }) {
    this.server.to(roomChannel(booking.roomId)).emit('booking:cancelled', booking);
  }
}
