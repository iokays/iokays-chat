const electron = require('electron');
const io = require('socket.io')(37927);
const ioClient = require('socket.io-client');
const dgram = require('dgram');
const uuid = require('uuid')
const low = require('lowdb');

const db = low('../db.json');
db.defaults({profile: {}, user: [], message: []}).value()

const server = dgram.createSocket('udp4');
server.on('listening', () => {
	  var address = server.address();
	  console.log('UDP Server listening on ' + address.address + ":" + address.port);
});
server.bind(37926);

server.on('message', function (message, remote) {	// 侦听用户上线
	console.log(remote.address + ':' + remote.port +' - ' + message)
	var msg = JSON.parse(message);
	var user = {id: msg.id, name: msg.name,  address: remote.address};
    console.log('user-reply: ' + JSON.stringify(user));
    db.get('user').remove({ id: user.id }).value();
    db.get('user').push(user).value();
    
    mainWindow.webContents.send('user-online', user);
});

var size = db.get('profile').size().value();
console.log('profile.size: ' + size);
if (0 == size) {
	  db.set('profile.id', uuid()).value();
	  // 生成随机用户
	  var date = new Date();
	  const profiles = ['Augus', 'Beacher', 'Claude', 'Derrick', 'Elliot', 'Frank', 'Gerald', 'Hardy', 'Ingemar', 'John', 'Kelly', 'Leo'];
	  db.set('profile.name', profiles[date % 12]).value();
}

profile = db.get('profile').value();
console.log('profile: ' + JSON.stringify(profile));

var client = dgram.createSocket("udp4");
client.bind(function () {
	client.setBroadcast(true);
});
var message = JSON.stringify(profile);	// 广播，我已登录
client.send(message, 0, message.length, 37926, '255.255.255.255', function(err, bytes) {
    if (err) throw err;
    client.close();
});

io.sockets.on('connection', function (socket) {	// 监听用户发来的消息.
	    socket.on('send-user-message', function (data) {
	    	data.receivedTime = new Date();
	    	db.get('message').push(data).value();
	    	console.log(data);
	    	mainWindow.webContents.send('user-message', data);
	    });
});

// 控制应用生命周期的模块。
const {app} = electron;
// 创建原生浏览器窗口的模块。
const {BrowserWindow} = electron;

// 保持一个对于 window 对象的全局引用，如果你不这样做，
// 当 JavaScript 对象被垃圾回收， window 会被自动地关闭
let mainWindow;

function createWindow() {
  // 创建浏览器窗口。
  mainWindow = new BrowserWindow({width: 1024, height: 768});

  // 加载应用的 index.html。
  mainWindow.loadURL(`file://${__dirname}/index.html`);

  // 启用开发工具。
  mainWindow.webContents.openDevTools();
  
  mainWindow.webContents.on("did-finish-load", function() {
  });

  // 当 window 被关闭，这个事件会被触发。
  mainWindow.on('closed', () => {
    // 取消引用 window 对象，如果你的应用支持多窗口的话，
    // 通常会把多个 window 对象存放在一个数组里面，
    // 与此同时，你应该删除相应的元素。
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);
// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

//In this file you can include the rest of your app's specific main process
//code. You can also put them in separate files and require them here.
const ipcMain = electron.ipcMain;

ipcMain.on('profile', function(event, arg) {
	var profile = db.get('profile').value();
	console.log('profile: ' + JSON.stringify(profile));
	event.returnValue = profile;
});

ipcMain.on('find-all-users', function(event, arg) {
	var users = db.get('user').value();
	console.log('users: ' + JSON.stringify(users));
	event.sender.send('find-all-users-reply', users);
});

ipcMain.on('find-all-messages', function(event, arg) {
	var messages = db.get('message').value();
	console.log('messages: ' + JSON.stringify(messages));
	event.sender.send('find-all-messages-reply', messages);
});

ipcMain.on('send-user-message', function(event, arg) {
	arg.id = uuid();
	arg.createdTime = new Date();
	arg.from = profile.id;
	console.log(arg);
	var to = db.get('user').find({ id: arg.to }).value();
	console.log("to: " + to);
	db.get('message').push(arg).value();
	event.sender.send('send-user-message-reply', arg);
	ioClient.connect('http://' + to.address + ':37927').emit('send-user-message', arg);
})
