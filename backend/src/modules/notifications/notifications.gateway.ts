import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/ws' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);
  private clients = new Map<string, string>(); // socketId -> userId

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.clients.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(client: Socket, payload: { userId: string; branchId?: string }) {
    this.clients.set(client.id, payload.userId);
    if (payload.branchId) client.join(`branch:${payload.branchId}`);
    client.join(`user:${payload.userId}`);
    client.emit('joined', { status: 'ok' });
  }

  @OnEvent('notification.created')
  handleNotification(payload: { branchId?: string; userId?: string; notification?: any }) {
    if (payload.branchId) {
      this.server.to(`branch:${payload.branchId}`).emit('notification', payload.notification);
    }
    if (payload.userId) {
      this.server.to(`user:${payload.userId}`).emit('notification', payload.notification);
    }
  }

  @OnEvent('sale.created')
  handleSaleCreated(sale: any) {
    this.server.to(`branch:${sale.branchId}`).emit('sale:new', {
      id: sale.id, invoiceNumber: sale.invoiceNumber, total: sale.total,
    });
  }
}
