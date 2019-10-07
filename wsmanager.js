


var wsmanager = {
  'version': 1,
  'configuration':
      {'url': '', 'heartBeatInterval': 500, 'sendWorkerInterval': 100},
  'init': function(url) {
    wsmanager.configuration.url = url;
    console.log('wsmanager v' + wsmanager.version + ' initialized');
    wsmanager._txQueue = [];  // {packet with ID, callback handler, repeat
                              // interval, time for next repeat, time to delete}
    wsmanager._rxQueue = [];  //
    wsmanager._state = 'offline';
    wsmanager._connect();
    wsmanager._statusChangedCallback = null;
    wsmanager._heartbeatTimer = null;
    wsmanager._initHeartbeatTimer();
    wsmanager._rxCallback = null;
    wsmanager._nextFreeTxID = 1;
    wsmanager._sendWorkerTimer = setInterval(
        wsmanager._sendWorkerFunc, wsmanager.configuration.sendWorkerInterval);
  },
  '_sendWorkerFunc': function() {
    for (let i = 0; i < wsmanager._txQueue.length; i++) {
      let req = wsmanager._txQueue[i];
      if (req.timeout > 0 &&
          req.todelete >= wsmanager.configuration.sendWorkerInterval)
        req.todelete -= wsmanager.configuration.sendWorkerInterval;
      else {
        if (typeof (req.callback) == 'function') {
          // console.log(req);
          req.callback('{\'error\':\'timeout\'}');
        }
        wsmanager._txQueue.splice(i, 1);
        console.log('wsmanager: delete element from txQueue');
        continue;
      }
      if (req.torepeat >= wsmanager.configuration.sendWorkerInterval)
        req.torepeat -= wsmanager.configuration.sendWorkerInterval;
      else {
        if (wsmanager._state == 'online') {
          console.log('wsmanager: try send...');
          wsmanager._sock.send(req.packet);
          req.torepeat = req.repeat;
          wsmanager._stopHeartbeatTimer();
          wsmanager._initHeartbeatTimer();
        }
      }
    }

    for (let i = 0; i < wsmanager._rxQueue.length; i++) {
      let req = wsmanager._rxQueue[i];
      if (req.todelete >= wsmanager.configuration.sendWorkerInterval)
        req.todelete -= wsmanager.configuration.sendWorkerInterval;
      else {
        wsmanager._rxQueue.splice(i, 1);
        console.log('wsmanager: delete element from rxQueue');
        continue;
      }
    }
  },
  'setRxCallback': function(func) {
    wsmanager._rxCallback = func;
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
    try {
      wsmanager._sock = new WebSocket(wsmanager.configuration.url);
      wsmanager._sock.onopen = wsmanager._onwsopen;
      wsmanager._sock.onclose = wsmanager._onwsclose;
      wsmanager._sock.onmessage = wsmanager._rxHandler;
    } catch {
      wsmanager._connect();
    }
  },
  'tx': function(method, data, timeout, callback) {
    let id = wsmanager._nextFreeTxID++;
    let msg = {'jsonrpc': '2.0', 'method': method, 'params': data, 'id': id};
    wsmanager._txQueue.push({
      'packet': JSON.stringify(msg),
      'id': id,
      'repeat': wsmanager.configuration.heartBeatInterval,
      'torepeat': 0,
      'timeout': timeout,
      'todelete': timeout,
      'callback': callback
    });
  },

  '_rxHandler': function(e) {
    wsmanager._stopHeartbeatTimer();
    wsmanager._initHeartbeatTimer();
    // JSON parse, compare id with currentTx packet ID
    let packet = null;
    try {
      packet = JSON.parse(e.data);
    } catch (err) {
      console.log('wsmanager: error parsing rx package:');
      console.log(e);
      return;
    }



    if (packet.method !== undefined) {
      for (let req of wsmanager._rxQueue) {
        if (req.id == packet.id) {
          req.todelete = wsmanager.configuration.heartBeatInterval * 10;
          if (req.answer !== null && wsmanager._state == 'online')
            wsmanager._sock.send(req.answer);
          return;
        }
      }
      wsmanager._rxQueue.push({
        'packet': e,
        'id': packet.id,
        'answer': null,
        'todelete': wsmanager.configuration.heartBeatInterval * 10
      });

      console.log('wsmanager: rx packet', e.data);

      packet.jsonrpc = null;

      if (typeof (wsmanager._rxCallback) == 'function') {
        wsmanager._rxCallback(packet)
      }
    } else {
      for (let i = 0; i < wsmanager._txQueue.length; i++) {
        let req = wsmanager._txQueue[i];
        if (req.id == packet.id) {
          if (typeof (req.callback) == 'function') {
            packet.id = null;
            packet.jsonrpc = null;
            req.callback(packet);
            wsmanager._txQueue.splice(i, 1);
            break;
          }
        }
      }
    }
  },
  'replyToPacket': function(id, answer) {
    for (let req of wsmanager._rxQueue) {
      if (req.id == id) {
        req.answer = JSON.stringify(answer);
        if (wsmanager._state == 'online') wsmanager._sock.send(req.answer);
        return;
      }
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
    if (wsmanager._state !== 'offline') {
      wsmanager._stopHeartbeatTimer();
      setTimeout(wsmanager._connect(), 1000);
      console.log('wsmanager: disconnected');
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
    if (wsmanager._heartbeatTimer !== null)
      clearInterval(wsmanager._heartbeatTimer);
    wsmanager._heartbeatTimer = setInterval(
        wsmanager._sendHeartbeat,
        wsmanager.configuration.heartBeatInterval * 2);
  },
  '_sendHeartbeat': function() {
    if (wsmanager._state == 'online') {
      wsmanager._sock.send(
          JSON.stringify({'jsonrpc': '2.0', 'method': 'ping'}));
      console.log('wsmanager: ping send');
    } else {
      wsmanager._onwsclose();
    }
  }

};

// можно добавить в статус попытки подключения, сделать интервал между попытками
// как в вк - от 0.5с до 30с
