import SocketClient from './SocketClient';

export default class SocketManager {
  clients: Map<string, SocketClient>;

  register(id: number, uid, role) {}

  destroy(id) {
    const client = this.clients.get(id);
    if (client) {
      client.disconnect();
      this.clients.delete(id);
    }
  }
}
