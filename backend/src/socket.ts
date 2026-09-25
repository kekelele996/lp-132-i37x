import { Server } from 'socket.io';
import { messages } from './constants/messages';
import { logger } from './utils/logger';

type MessagePayload = {
  receiver_id: string;
  [key: string]: unknown;
};

export const registerSocketHandlers = (io: Server): void => {
  io.on('connection', (socket) => {
    logger.info(`${messages.socket.connected}: ${socket.id}`);

    socket.on('join', (userId: string) => {
      socket.join(userId);
      logger.info(`${messages.socket.joinedRoom}: ${userId}`);
    });

    socket.on('send_message', (data: MessagePayload) => {
      io.to(data.receiver_id).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
      logger.info(`${messages.socket.disconnected}: ${socket.id}`);
    });
  });
};
