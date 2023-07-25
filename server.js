const app = require("express")();

const http = require("http");
const { Server } = require("socket.io");
const Controller = require("./Controller.js");

const multer = require("multer");
const cookieParser = require("cookie-parser");

const PORT = process.env.PORT || 8080;

const httpServer = http.createServer(app); // Initializing http server
const io = new Server(httpServer); // Initializing WSS

const PIN = 1234;

const controller = new Controller();

app.use(multer().array());
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

  res.cookie("pin", pin, {maxAge: 9999, httpOnly: true});
  res.cookie("uid", name, {maxAge: 9999, httpOnly: true});

  res.sendStatus(200);
});

app.post("/create-room", (req, res) => {
  const { name, rounds, readerVisible, selfReading } = req.body;
});

io.on("connection", (socket) => {
  socket.on("disconnect", function () {
    console.log("user disconnected");
  });
});

httpServer.listen(PORT, function () {
  console.log(`Listening on port ${PORT}`);
});
