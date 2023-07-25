class Player {
  constructor(name) {
    this.name = name;
    console.log("init player ", name)
  }
}

class GameRoom {
  constructor(pin) {
    this.pin = pin;
    this.players = {};
    console.log("init room ", pin);
  }

  registerPlayer(name) {
    this.players[name] = new Player(name);
  }
}

class Controller {
  constructor() {
      console.log("Initialized controller");
      this.rooms = {1234: new GameRoom(1234)}; // Should be empty, just for debug
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
}

module.exports = Controller;
