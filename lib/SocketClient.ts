import SocketIOClient from 'socket.io-client';
import url from 'url';

import traverse from '../utils/traverse';

function getServerAddress() {
  return '1';
}

interface ConstructorParams {
  role: string,
  namespace: string;
  autoInit?: boolean
}


export default class SocketClient {
  socket;
  events;
  channelName;
  uid;
  role;
  namespace;

  constructor(channelName: string, uid: string, params: ConstructorParams) {
    this.events = {};
    this.channelName = channelName;
    this.uid = uid;
    this.role = params.role;
    this.namespace = params.namespace;
    if(!params.autoInit){
      this.initSocket();
    }
  }

  //初始化Socket
  initSocket() {
    const u = url.parse(`${getServerAddress()}${this.namespace ? `/${this.namespace}` : ''}`);
    const socketIoHost = `${u.protocol || ''}//${u.host || ''}/`;
    this.socket = new SocketIOClient(socketIoHost, {path: u.path});

    this.socket.on('disconnect', (reason) => {
      this.printLog(`Socket disconnect because of the reason: ${reason}`);
      traverse(this.events, e => {e.isListening = false;});
      this.disconnect();
      this.initSocket();
    });

    this.socket.on('error', (err) => this.printLog(`Got socket.io error: ${err}`));

    this.socket.on('connect', () => {
      this.printLog('connection was successful.');
      this.join();
    });
  }

  //加入
  join() {
    const args = {
      room: this.channelName`_${this.role}`,
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

  to(role: string, uid: number | null, event: string, message: any) {
    if (!this.socket) {
      throw new Error('请先启动Socket.IO服务后调用broadcastTo方法');
    }
    const emitEvent = uid ? 'to' : 'broadcastTo';
    this.socket.emit(emitEvent, {
      room: `meeting_room_${this.channelName}_${role}`, event, uid, message
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }

  printLog(message){
    console.log(`[socket.io-transit-client] ${message}`);
  }

}
