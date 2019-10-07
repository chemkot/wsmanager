
var wsmanager = {
  'version': 1,
  'configuration': {'port': 81, 'heartbeatinterval': 500},
  'init': function() {
    console.log('wsmanager v' + wsmanager.version + 'initialized');
    wsmanager._queue = [];
    wsmanager._currentTxPacket = null;
    wsmanager._currentTxPacketID = 0;
    wsmanager._lastHandledRxPacketID = -1;
    wsmanager._state = 'offline';
    wsmanager._connect();
    wsmanager._statusChangedCallback = null;
    wsmanager._onMessageCallback = null;
    wsmanager._heartbeatTimer = null;
    wsmanager._reinitHeartbeatTimer();
    wsmanager._rxCallback = null;
  },
  'setRxCallback': function(func) {
    wsmanager.rxCallback = func;
  },
  'setConnectionStateChangedCallback': function(func) {
    wsmanager._statusChangedCallback = func;
  },
  'getConnectionState': function() {
    return wsmanager._state;
  },
  '_connect': function() {
    console.log('wsmanager: try connect...');
    wsmanager._sock = null;
    wsmanager._sock = new WebSocket(wsmanager.configuration['port']);
    wsmanager._sock.onopen = wsmanager._onwsopen;
    wsmanager._sock.onclose = wsmanager._onwsclose;
    wsmanager._sock.onmessage = wsmanager._rxHandler;
  },
  'tx': function(method, data, callback) {
    let msg = {'jsonrpc': '2.0', 'method': method, 'params': data};
    wsmanager._queue.push(JSON.stringify(msg));
    if (wsmanager._currentTxPacket === null) {
      wsmanager._prepareNextMsg();
      wsmanager._trySend();
    }
  },
  '_prepareNextMsg': function() {
    if (wsmanager._queue.length > 0) {
      wsmanager._currentTxPacket = wsmanager._queue.shift();
      wsmanager._currentTxPacketID++;
      wsmanager._currentTxPacket['id'] = wsmanager._currentTxPacketID;
    }
  },
  '_trySend': function() {
    wsmanager._sock.send(wsmanager._currentTxPacket);
  },
  '_rxHandler': function(e) {
    wsmanager._stopHeartbeatTimer();
    wsmanager._initHeartbeatTimer();
    // JSON parse, compare id with currentTx packet ID
    let packet = null;
    try {
      packet = JSON.parse(raw);
    } catch (err) {
      console.log('wsmanager: error parsing rx package');
      return;
    }
    if (Number(packet.id) == Number(wsmanager._currentTxPacketID)) {
      wsmanager._prepareNextMsg();
      wsmanager._trySend();
    }
    if (packet.method !== undefined &&
        wsmanager._lastHandledRxPacketID != Number(packet.id)) {
      if (wsmanager._rxCallback !== null) wsmanager._rxCallback(packet);
      wsmanager._lastHandledRxPacketID = Number(packet.id);
    } else {
    }
  },
  '_onwsopen': function() {
    console.log('wsmanager: connected');
    wsmanager._state = 'online';
    wsmanager._initHeartbeatTimer();
    if (wsmanager._statusChangedCallback !== null)
      wsmanager._statusChangedCallback(wsmanager._state);
  },
  '_onwsclose': function() {
    console.log('wsmanager: disconnected');
    wsmanager._stopHeartbeatTimer();
    setTimeout(1000, wsmanager._connect());
    if (wsmanager._state !== 'offline') {
      wsmanager._state = 'offline';
      if (wsmanager._statusChangedCallback !== null)
        wsmanager._statusChangedCallback(wsmanager._state);
    }
  },
  '_stopHeartbeatTimer': function() {
    if (wsmanager._heartbeatTimer !== null) {
      clearInterval(wsmanager._heartbeatTimer);
      wsmanager._heartbeatTimer = null;
    }
  },
  '_initHeartbeatTimer': function() {
    wsmanager._heartbeatTimer = setInterval(
        wsmanager.configuration.heartbeatinterval, wsmanager._sendHeartbeat);
  },
  '_sendHeartbeat': function() {
    if (wsmanager._sock !== null) {
      if (wsmanager._currentTxPacket === null) {
        wsmanager._sock.send(
            JSON.stringify({'jsonrpc': '2.0', 'method': 'ping'}));
        console.log('wsmanager: ping send');
      } else {
        wsmanager._trySend();
        console.log('wsmanager: resend current packet');
      }
    } else {
      wsmanager._onwsclose();
    }
  }

};
window.addEventListener('load', wsmanager.init);

// можно добавить в статус попытки подключения, сделать интервал между попытками
// как в вк - от 0.5с до 30с

// при обрыве интернет-соединения сработает событие ws.close?

// могут ли быть запоздалые пакеты? например, получили пакет с id == 5, потом
// приходит с id == 4?