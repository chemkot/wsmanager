simple library for using web-sockets

wsmanager.init(url, port)
wsmanager.setRxCallback(function(r){}); // вызовы RPC от другой стороны, в коллбэке нужно вернуть result или error. Может быть с await внутри, в это время модуль не вызывает коллбэк повторно при приходе повторных запросов от клиента ; отправить что обрабатывается ; храним в таблице  

wsmanager.send(method, data, function Callback(r){...}); // асинхронно отправляются, при отсутствии ответа в течении Х повторная отправка. Получили ответ - вызвали коллбэк, удалили из таблицы. 
