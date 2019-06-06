var util = require("./util");
var serveur = require("./server");
var client = require("./client");

function createClient(){

  var cli = new client();
  return cli;
};

function createServer(hostname, port){

  var serv = new serveur();
  serv.createServer(hostname, port);
  return serv._server;
};

module.exports.createClient = createClient;
module.exports.createServer = createServer;
module.exports.util = util;
