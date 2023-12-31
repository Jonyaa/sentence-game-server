const express = require("express");

// DELETE, ONLY FOR DEVELOPMENT
const cors = require("cors");

const http = require("http");
const { Server } = require("socket.io");
const Controller = require("./Controller.js");

const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const multer = require("multer")();
const cookieParse = require("cookie");

const PORT = process.env.PORT || 8080;

// DELETE, ONLY FOR DEVELOPMENT
const app = express();

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

const httpServer = http.createServer(app); // Initializing http server
// const io = new Server(httpServer); // Initializing WSS

// DELETE, ONLY FOR DEVELOPMENT
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true
  }
})

const PIN = 1234;



const controller = new Controller();

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(multer.array());
app.use(cookieParser());

app.get("/", (req, res) => {
  // This should server the react bundle.
  res.sendFile(__dirname + "/public/index.html");
});

// DELETE, ONLY FOR DEVELOPMENT
app.get("/lobby", (req, res) => {
  res.sendFile(__dirname + "/public/lobby.html");
});

// DELETE, ONLY FOR DEVELOPMENT
app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/public/admin.html");
});

app.post("/connect", (req, res) => {
  const { pin, uid } = req.body;
  try {
    controller.validateLogin(pin, uid);
  } catch (error) {
    res.status(400).json(String(error));
    return;
  }

  res.cookie("pin", pin, { maxAge: 99999, httpOnly: false });
  res.cookie("uid", uid, { maxAge: 99999, httpOnly: false });

  // res.sendStatus(200);
  res.status(200).redirect("/lobby");
});

app.post("/create-room", (req, res) => {
  const name = req.body.uid;
  const selfRead = req.body.selfRead === "on";
  const readerVisible = req.body.readerVisible === "on";
  let pin;

  try {
    pin = controller.createRoom(name, selfRead, readerVisible, io);
  } catch (error) {
    res.status(400).json(String(error));
    return;
  }

  res.cookie("uid", name, { maxAge: 99999, httpOnly: false });
  res.cookie("pin", pin, { maxAge: 99999, httpOnly: false });
  res.status(200).redirect("/lobby");
});

io.on("connection", (socket) => {
  if (!socket.handshake.headers.cookie) {
    // In case of no cookies, fallback
    socket.emit("redirect", "/");
    return;
  }

  const cookie = cookieParse.parse(socket.handshake.headers.cookie);
  const pin = cookie.pin;
  const uid = cookie.uid;

  try {
    controller.validateLogin(pin, uid);
  } catch (error) {
    socket.emit("redirect", "/");
    return;
  }

  controller.connectPlayer(pin, uid, socket);

});

httpServer.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
});
