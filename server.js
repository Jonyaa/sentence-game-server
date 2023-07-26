const app = require("express")();

const http = require("http");
const { Server } = require("socket.io");
const Controller = require("./Controller.js");

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const multer = require("multer")();
const cookieParse = require("cookie");

const PORT = process.env.PORT || 8080;

const httpServer = http.createServer(app); // Initializing http server
const io = new Server(httpServer); // Initializing WSS

const PIN = 1234;

const controller = new Controller();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer.array()); 
app.use(cookieParser());

app.get("/", (req, res) => {
  // This should server the react bundle.
  res.sendFile(__dirname + "/public/index.html");
});

app.post("/connect", (req, res) => {
  const { pin, name } = req.body;
  console.log(name);
  try {
    controller.connectPlayer(pin, name);
  } catch (error) {
    res.status(400).json(String(error));
    return;
  }

  res.cookie("pin", pin, { maxAge: 9999, httpOnly: true });
  res.cookie("uid", name, { maxAge: 9999, httpOnly: true });

  res.sendStatus(200);
});

app.post("/create-room", (req, res) => {
  const name = req.body.name;
  const rounds = Number(req.body.rounds);
  const selfRead = req.body.selfRead === "on";
  const readerVisible = req.body.readerVisible === "on";
  let pin;

  try {
    pin = controller.createRoom(name, rounds, selfRead, readerVisible);
  } catch (error) {
    res.status(400).json(String(error));
  }

  res.cookie("uid", name, { maxAge: 9999, httpOnly: true });
  res.cookie("pin", pin, { maxAge: 9999, httpOnly: true });
  res.sendStatus(200);
});

io.on("connection", (socket) => {
  const cookie = cookieParse.parse(socket.handshake.headers.cookie);
  const pin = cookie.pin;
  const uid = cookie.uid;

  socket.join(pin);
  controller.registerSocket(uid, pin, socket);

  // socket.on("disconnect", function () {
  //   console.log("user disconnected");
  // });
});

httpServer.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
});
