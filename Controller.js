const DISCONNECTION_TIMEOUT = 10000;

class Player {
  constructor(uid, socket, room, isAdmin) {
    this.uid = uid;
    this.socket = socket;
    this.room = room; // ref to the room
    this.text = null;
    this.reading = null;
    this.state = "ready";
    this.isAdmin = isAdmin;

    console.log(
      `${isAdmin ? "Admin " + uid : uid} is connected to room ${room.pin}`
    );

    this.registerSocketMethods();
  }

  registerSocketMethods() {
    this.socket.on("disconnect", () => {
      if (this.room.state === "lobby2") {
        console.log(`${this.uid} disconnected`);
        delete this.room.players[this.uid];
      } else if (this.room.state === "lobby") {
        this.room.playerDisconnected(this.uid);
      }
    });
  }

  emit(eventName, ...data) {
    this.socket.emit(eventName, ...data);
  }
}

class GameRoom {
  constructor(pin, admin, roomSocket, pref) {
    this.admin = admin;
    this.pin = pin;
    this.roomSocket = roomSocket;
    this.state = "lobby";
    this.activePlayer = null;
    this.currentRound = 0;
    this.pref = pref;

    this.players = {};

    console.log("created room " + pin + ", admin is " + admin);
  }

  connectPlayer(uid, socket) {
    socket.join(this.pin);
    this.players[uid] = new Player(uid, socket, this, uid === this.admin);
    console.log("PLAYERS: " + Object.keys(this.players));
  }

  playerDisconnected(uid) {
    this.state = "waiting";
    // SEND BROADCAST MESSAGE OF ROOMS IS WAITING
    this.roomSocket.emit("freeze", `${uid} disconnected`)
    setTimeout(() => {
      // SEND BROADCAST MESSAGE OF REDIRECTION HOME
      console.log("deleting room"); 
      delete this;
    }, DISCONNECTION_TIMEOUT);
  }
}

class Controller {
  constructor() {
    console.log("Initialized controller");
    this.rooms = {}; // Should be empty, just for debug
  }

  validateLogin(pin, uid) {
    // Called by the express upon login request,
    // verifies that the inputs are valid - name is not taken and room exists

    if (!(pin in this.rooms)) {
      throw new Error("room doesn't exist");
    }

    if (uid in this.rooms[pin].players) {
      throw new Error("name already taken");
    }
  }

  connectPlayer(pin, uid, socket) {
    this.rooms[pin].connectPlayer(uid, socket);
    socket.join(pin);
  }

  generatePin() {
    const newPin = Math.round(Math.random() * 9000 + 1000);
    if (newPin in this.rooms) {
      return this.generatePin();
    }
    return newPin;
  }

  createRoom(player, rounds, selfRead, readerVisible, socketServer) {
    const pin = this.generatePin();
    this.rooms[pin] = new GameRoom(pin, player, socketServer.to(pin), {
      rounds,
      selfRead,
      readerVisible,
    });
    return pin;
  }
}

module.exports = Controller;
