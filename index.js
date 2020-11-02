import SocketIOClient from 'socket.io-client';
import url from 'url';

// 服务端地址
let ServerAddress = '';

class SocketClient {
  socket;
  events;
  channelName;
  uid;
  role;

  constructor(channelName, uid, role) {
    this.events = {};
    this.channelName = channelName;
    this.uid = uid;
    this.role = role;
    this.initSocket();
  }

  static setServerAddress(serverAddress) {
    ServerAddress = serverAddress;
  }

  initSocket() {
    const u = url.parse(`${ServerAddress}/roll-call`);
    const socketIoHost = `${u.protocol || ''}//${u.host || ''}/`;
    this.socket = new SocketIOClient(socketIoHost, {path: u.path});
    this.socket.on('disconnect', (reason) => {
      console.log(`Socket disconnect because of the reason: ${reason}`);
      traverse(this.events, e => {e.isListening = false;});
      this.disconnect();
      this.initSocket();
    });
    this.socket.on('error', (err) => {
      console.log(`Got socket.io error: ${err}`);
    });
    this.socket.on('connect', () => {
      console.log('[socket.io] connection was successful.');
      this.join();
    });
  }

  join() {
    const args = {
      room: `meeting_room_${this.meetingId}_${this.role}`,
      uid: this.uid,
      syncTime: true
    };
    this.socket.emit('join', args, (result) => {
      if (!result.success) {
        this.disconnect();
        console.error(`[socket.io] Join the room failed with error: ${result.error}`);
        return;
      }
      this.refresh();
      console.log('[socket.io] Join the room successfully.');
    });
  }

  refresh() {
    traverse(this.events, (value, key) => {
      if (value.isListening) {
        return;
      }
      console.log(`[socket.io] Register event ${key}`);
      value.isListening = true;
      this.socket.on(key, (...args) => value.methods.map(c => c.method(...args)));
    });
  }

  on(key, eventName, callback) {
    const item = {key, method: callback};
    if (this.events[eventName]) {
      this.events[eventName].methods.push(item);
    } else {
      this.events[eventName] = {isListening: false, methods: [item]};
    }
    this.refresh();
  }

  clearEvents(key) {
    console.log(`[${key}] Delete events.`);
    const newEvents = {};
    traverse(this.events, value => {
      newEvents[key] = value.methods.filter(item => item.key !== key);
    });
  }

  emit(...args) {
    this.socket.emit(...args);
  }

  broadcastTo(role: 'master' | 'attendee', uid: number | null, event: string, message: any) {
    if (!this.socket) {
      throw new Error('请先启动Socket.IO服务后调用broadcastTo方法');
    }
    const emitEvent = uid ? 'to' : 'broadcastTo';
    this.socket.emit(emitEvent, {
      room: `meeting_room_${this.meetingId}_${role}`, event, uid, message
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

export class SocketManager {
  managers: Map<number, SocketClient> = new Map();

  register(id: number, uid, role): SocketClient {
    if (!id) {
      return;
    }
    const key = new Date().getTime();
    const client = new SocketClient(id, uid, role);
    this.managers.set(id, client);
    client.on = client.on.bind(client, key);
    client.clearEvents = client.clearEvents.bind(client, key);
    return client;
  }

  destroy(id) {
    const manger = this.managers.get(id);
    if (manger) {
      manger.disconnect();
      this.managers.delete(id);
    }
  }
}

const manger = new SocketManager();

window.SocketManager = manger;
global.SocketManager = manger;

export default manger;


function traverse(iterator, mapper) {
  const result = [];
  for (const value in iterator) {
    if (Object.prototype.hasOwnProperty.call(iterator, value)) {
      result.push(mapper(iterator[value], value) || null);
    }
  }
  return result;
}

