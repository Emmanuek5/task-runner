const {Client} = require('./indexinclass.js');
const path = require('path');
const fs = require('fs');
  process.on("uncaughtException", (error) => {
    console.log(error);
  });

  process.on("unhandledRejection", (error) => {
    console.log(error);
  });

const servers = [
  {
    name: "server1",
    ip: "localhost",
    port: 3000,
    current_load: 0,
    best_load: 0,
  },
  {
    name: "server2",
    ip: "localhost",
    port: 3001,
    current_load: 0,
    best_load: 0,
  },
  {
    name: "Server 3",
    ip: "localhost",
    port: 3002,
    current_load: 0,
    best_load: 0,
  },
  {
    name: "Server 4",
    ip: "localhost",
    port: 3003,
    current_load: 0,
    best_load: 0,
  },
];


const client = new Client(servers, 100);

 
    client.connect();
    client.on("all_connected",(servers)=>{
      console.log(servers.length)
      console.log("Connected to all servers :"+ client.best_load);
      const pathtofile = path.join(__dirname, "./servers.json");
      client.on("taskCompleted", (task) => {
        
        client.servers.forEach((server) => {
          console.log(server.current_load);
        });
        console.log(task);
      });

        ; 
   
    
    });

    
