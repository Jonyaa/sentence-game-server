const DISCONNECTION_TIMEOUT = 10000;

class Player {
  constructor(uid, socket, room, isAdmin) {
    this.uid = uid;
    this.socket = socket;
    this.room = room; // ref to the room
    this.gameData = null;
    this.state = "ready";
    this.isAdmin = isAdmin;
    this.disconnection_timeout = null;

    console.log(
      `${isAdmin ? "Admin " + uid : uid} is connected to room ${room.pin}`
    );

    this.registerSocketMethods();
  }

  registerSocketMethods = () => {
    this.socket.on("disconnect", () => {
      this.room.playerDisconnected(this.uid);
    });
    if (this.isAdmin) {
      this.socket.on("start", () => {
        console.log(`starting room ${this.room.pin}`);
        this.room.start();
      });
    }
  };

  reconnect = (socket) => {
    this.socket = socket;
    this.registerSocketMethods();
    this.state = "ready";
    socket.emit("reconnect", { state: this.room.state, data: this.gameData });
    clearTimeout(this.disconnection_timeout);
  };

  emit = (eventName, ...data) => {
    this.socket.emit(eventName, ...data);
  };
}

class GameRoom {
  constructor(pin, admin, roomSocket, destroy, pref) {
    this.admin = admin;
    this.pin = pin;
    this.roomSocket = roomSocket;
    this.destroy = destroy;
    this.state = "lobby";
    this.activePlayer = null;
    this.currentRound = 0;
    this.pref = pref;

    this.players = {};
    console.log("created room " + pin + ", admin is " + admin);
  }

  connectPlayer = (uid, socket) => {
    socket.join(this.pin);

    if (uid in this.players) {
      // reconnected user
      console.log(`${uid} reconnected`);
      this.roomSocket.emit("continue");
      this.state = "running";
      this.players[uid].reconnect(socket);
    } else {
      // new user
      this.players[uid] = new Player(uid, socket, this, uid === this.admin);
      if (uid === this.admin) {
        socket.emit("admin");
      }
    }

    this.roomSocket.emit("players_update", {
      playersList: Object.keys(this.players),
      pin: this.pin,
    });
  };

  kickPlayer = (uid) => {
    delete this.players[uid];
    this.roomSocket.emit("players_update", {
      playersList: Object.keys(this.players),
    });
    console.log(`kicked ${uid} from ${this.pin}`);
  };

  playerDisconnected = (uid) => {
    if (this.state === "lobby") {
      // disconnection in lobby - kicks player, except if it's the admin then it destroys the room
      if (this.players[uid].isAdmin) {
        this.destroy(this.pin);
      } else {
        this.kickPlayer(uid);
      }
    } else if (this.state === "running") {
      // disconnection in game - freezes game and waits for reconnection
      console.log(
        `${uid} disconnected from running game, waiting to reconnect`
      );
      this.state = "waiting";
      this.players[uid].state = "disconnected";
      this.roomSocket.emit("waiting", uid);

      this.players[uid].disconnection_timeout = setTimeout(
        () => this.destroy(this.pin),
        DISCONNECTION_TIMEOUT
      );
    }
  };

  start = () => {
    this.state = "running";
    this.roomSocket.emit("starting");
  };
}

class Controller {
  constructor() {
    console.log("Initialized controller");
    this.rooms = {}; // Should be empty, just for debug
  }

  validateLogin = (pin, uid) => {
    // Called by the express upon login request,
    // verifies that the inputs are valid - name is not taken and room exists

    if (!(pin in this.rooms)) {
      throw new Error("room doesn't exist");
    }

    if (
      uid in this.rooms[pin].players &&
      this.rooms[pin].players[uid].state === "ready"
    ) {
      throw new Error("name already taken");
    }
  };

  connectPlayer = (pin, uid, socket) => {
    this.rooms[pin].connectPlayer(uid, socket);
    socket.join(pin);
  };

  generatePin = () => {
    const newPin = Math.round(Math.random() * 9000 + 1000);
    if (newPin in this.rooms) {
      return this.generatePin();
    }
    return newPin;
  };

  destroyRoom = (pin) => {
    console.log(`destroying room ${pin}`);
    this.rooms[pin].roomSocket.emit("destroy");
    delete this.rooms[pin];
  };

  createRoom = (player, rounds, selfRead, readerVisible, socketServer) => {
    // const pin = this.generatePin();
    const pin = 1111;
    this.rooms[pin] = new GameRoom(
      pin,
      player,
      socketServer.to(pin),
      this.destroyRoom,
      {
        rounds,
        selfRead,
        readerVisible,
      }
    );
    return pin;
  };
}

module.exports = Controller;
