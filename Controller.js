class Player {
  constructor(name) {
    this.name = name;
    this.text = null;
    this.reading = null;
    this.state = "socket pending";
    this.socket = null;
  }

  registerSocket(socket) {
    this.socket = socket;
    this.state = "ready";
    console.log(this.name + " is ready");

    socket.on("disconnect", () => {
      console.log(this.name + " disconnecte");
    });
  }
}

class GameRoom {
  constructor(pin, admin, pref) {
    this.admin = admin;
    this.pin = pin;
    this.state = "lobby";
    this.activePlayer = null;
    this.currentRound = 0;
    this.pref = pref;

    this.players = {};

    this.registerPlayer(admin); // Registering the admin as one of the room players
    console.log("created room " + pin + ", admin is " + admin);
  }

  registerPlayer(name) {
    this.players[name] = new Player(name);
  }

  registerSocket(uid, socket) {
    this.players[uid].registerSocket(socket);
    socket.emit("test", "test");
  }
}

class Controller {
  constructor() {
    console.log("Initialized controller");
    this.rooms = {}; // Should be empty, just for debug
  }

  connectPlayer(pin, player) {
    console.log(this.rooms);
    if (!(pin in this.rooms)) {
      throw new Error("room doesn't exist");
    }

    if (player in this.rooms[pin].players) {
      throw new Error("name already taken");
    }

    this.rooms[pin].registerPlayer(player);
  }

  generatePin() {
    const newPin = Math.round(Math.random() * 9000 + 1000);
    if (newPin in this.rooms) {
      return this.generatePin();
    }
    return newPin;
  }

  createRoom(player, rounds, selfRead, readerVisible) {
    const pin = this.generatePin();
    this.rooms[pin] = new GameRoom(pin, player, {
      rounds,
      selfRead,
      readerVisible,
    });
    return pin;
  }

  registerSocket(uid, pin, socket) {
    this.rooms[pin].registerSocket(uid, socket);
  }
}

module.exports = Controller;
