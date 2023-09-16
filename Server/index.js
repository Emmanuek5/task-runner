const net = require("net");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const portscanner = require("portscanner");
let PORT_TO_CHECK = 3000;


const runningTasks = [];
process.on("uncaughtException", (error) => {
  console.log(error);
});

process.on("unhandledRejection", (error) => {
  console.log(error);
});


const server = net.createServer( async (socket) => {
  console.log("Client connected ");

  socket.on("data", async (dataa) => {
    const data = JSON.parse(dataa);
    console.log(data);
    // Data received from client

    // Check if the client is sending a message
    
    if (data.message  && !data.command) {
      const msg = data.message;
      const cmd = data.command;
      if (msg === "hello") {
        socket.write("hello");
      }
    }
    // Execute the command
    const command = data.task;
    const id = data.id;
    if (data.type === "file" && data.file == true) {
       const url = data.task;
      const filename = data.filename;
      const file = fs.createWriteStream(path.join(__dirname, filename));

      const request = await fetch(url);
      if (request.ok) {
        const fileData = await request.text(); // Buffer the response data
        file.write(fileData);
        file.end();

          const output = {
            message: "File downloaded",
            status: "completed",
            id: id,
          };
          socket.write(JSON.stringify(output));
          
        return;
      }else{
         const output = {
            message: "File not downloaded",
          status: "error",
          id: id,
        };
        
        socket.write(JSON.stringify(output));
        return;
      }

    }
    
    const childProcess = spawn(command, [], { shell: true });
    childProcess.id = id;
    childProcess.satus = ""
    childProcess.messages = ""
    childProcess.errors = ""
    runningTasks.push(childProcess);
  

     

    childProcess.stdout.on("data", (data) => {
      // Send the output back to the client
      childProcess.messages += data
      const output = { message: data , status : childProcess.status , id : childProcess.id}
      socket.write(JSON.stringify(output));
    });


    childProcess.stderr.on("data", (error) => {
      // Send the error message back to the client
 childProcess.errors += error;
       const output = {
         message: childProcess.errors,
         status: childProcess.status,
         id: childProcess.id,
       };

  
      socket.write(JSON.stringify(output));
    });

    childProcess.on("close", () => {
      // Notify the client that the task has completed
      childProcess.status = "completed"
      const output = {
        message: " \n",
        status: childProcess.status,
        id: childProcess.id,
      };


      socket.write(JSON.stringify(output));
    });
  });

  socket.on("end", () => {
    console.log("Client disconnected");
  });
});

function startServerOnAvailablePort() {
  portscanner.checkPortStatus(PORT_TO_CHECK, "127.0.0.1", (error, status) => {
    if (error) {
      console.error("Error checking port status:", error);
      return;
    }

    if (status === "closed") {
      // The port is closed, start the server
      server.listen(PORT_TO_CHECK, () => {
        console.log(`Server listening on port ${PORT_TO_CHECK}`);
      });
    } else {
      // The port is open, increment the port and check again
      PORT_TO_CHECK++;
      startServerOnAvailablePort();
    }
  });
}

// Start checking for an open port
startServerOnAvailablePort();