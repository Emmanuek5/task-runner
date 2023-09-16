const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const express = require("express");
const app = express()
const events = require("events");
const eventEmitter =new  events.EventEmitter();

class Client {
  constructor(serversfrom, loadperserver) {
    process.on("uncaughtException", (error) => {
      console.log(error);
    });

    process.on("unhandledRejection", (error) => {
      console.log(error);
    });

    /**
     * @type {Array<{
     *   name: string,
     *   ip: string,
     *   port: number,
     *   current_load: number,
     *   best_load: number
     * }>}
     *
     */
    this.servers = serversfrom;
    this.best_load = this.calculateLoadPerServer();
    this.server_type = {
      name: "",
      ip: "",
      port: 0, // Initialize to 0, you can adjust this default value
      current_load: 0,
      best_load: 0,
    };
    this.running_tasks = [];
    this.server_connections = [];
    this.connected = false;
    this.upload_url = "https://file-host11.blueobsidian.repl.co/upload";

    /**
     * Registers an event listener for the specified event.
     *
     * @param {string} eventName - The name of the event to listen for.
     * @param {function} listener - The function to be called when the event is triggered.
     */
    this.on = (eventName, listener) => {
      eventEmitter.on(eventName, listener);
    };

    this.loadperserver = this.calculateLoadPerServer();
    events.EventEmitter.defaultMaxListeners = 100;
  }

  connect() {
    this.servers.forEach((server) => {
      const serverConnection = net.createConnection(server, () => {
        serverConnection.name = server.name;
        server.best_load = this.calculateLoadPerServer();
        server.current_load = 0;
        server.connected = true;
        this.connected = true;
        server.connection = serverConnection;
        this.server_connections.push(serverConnection);
        eventEmitter.emit("connected", serverConnection, server);
        if (this.server_connections.length === this.servers.length) {
          this.connected = true;
          eventEmitter.emit("all_connected", this.servers);
        }
      });

      serverConnection.on("data", (data) => {
        try {
          const output = JSON.parse(data.toString());

          let task = this.running_tasks.find((t) => t.id === output.id);
      
          if (task) {
            task.output += output.message;
            task.status = output.status;

            if (output.status === "completed") {
              server.current_load -= 10;
              eventEmitter.emit("taskCompleted", task);
              this.running_tasks = this.running_tasks.filter((task) => {
                return task.id !== output.id;
              }
              );
            }
          } else {
            task = {
              id: output.id,
              output: output.message,
              status: output.status,
              server: server.name,
            };

            this.running_tasks.push(task);
          }

          eventEmitter.emit("taskUpdated", task);
        } catch (error) {
          console.error("Error parsing data:", error);
        }
      });

      serverConnection.on("end", () => {
        eventEmitter.emit("serverDisconnect", server);
        this.server_connections = this.server_connections.filter((server) => {
          return server.name !== serverConnection.name;
        });
      });

      serverConnection.on("error", (error) => {
        eventEmitter.emit("serverError", server);
        console.log("There was an error on the connection to " + server.name);
      });
    });
  }

  calculateLoadPerServer() {
   const load = this.servers.length * 1000 ;
    return load;
  }

  /**
   * Runs a task on the server with the lowest load.
   *
   * @param {string} task - The task to be run.
   * @return {number} The ID of the submitted task.
   */
  runTask(task,load) {
    
    //get the server that is connected and has the lowest load

    if (!this.connected) {
      console.log("Not connected to any server");
      return;
    }
    const server = this.servers.find((server) => {
      return server.connected && server.current_load  < this.best_load;
    });
    if (!server) {
      console.log("No server available");
      return;
    }
    const serverConnection = server.connection;
    const id = Math.floor(Math.random() * 1000);
    const tasktosend = {
      id: id,
      task: task,
      message: "Task submitted",
      server: server.name,
    };
    this.running_tasks.push(tasktosend);
    server.current_load += 10;

    serverConnection.write(JSON.stringify(tasktosend));
    return id;
  }
  async uploadFile(filePath, filename) {
    if (!this.connected) {
      console.log("Not connected to any server");
      return null; // Return null or an error code to indicate failure
    }

    try {
      // Read the file content from the local file system
      const fileContent = await new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
          if (err) {
            console.error("Error reading the file:", err);
            reject(err);
          } else {
            resolve(data);
          }
        });
      });

      // Create a Blob from the file content
      const fileBlob = new Blob([fileContent]);
      fileBlob.name = filename;
      // Prepare a FormData object with the file
      const formData = new FormData();
      formData.append("file", fileBlob);
      formData.append("filename", filename);
  
      // Send the file to the server
      const response = await fetch(this.upload_url, {
        method: "POST",
        body: formData,
      });
      

      if (response.status === 200) {
        const data = await response.json();
      
        return data; // Return the ID of the uploaded file
      } else {
        console.error(
          "Failed to upload file:",
          response.status,
          response.statusText
        );
        return null; // Return null or an error code to indicate failure
      }
    } catch (error) {
      console.error("Error during file upload:", error);
      return null; // Return null or an error code to indicate failure
    }
  }

  async downloadFile(server, filename) {
    if (!this.connected) {
      console.log("Not connected to any server");
      return null; // Return null or an error code to indicate failure
    }

    try {
      const response = await fetch(server.download_url + filename);

      if (response.ok) {
        const fileData = await response.buffer(); // Buffer the response data

        // You can save the downloaded file to a local directory or return it as needed
        // For example, to save it locally:
        const savePath = path.join(__dirname, "downloads", filename);
        fs.writeFileSync(savePath, fileData);

        console.log(`File '${filename}' downloaded successfully.`);
        return savePath; // Return the path to the saved file
      } else {
        console.error(
          "Failed to download file:",
          response.status,
          response.statusText
        );
        return null; // Return null or an error code to indicate failure
      }
    } catch (error) {
      console.error("Error during file download:", error);
      return null; // Return null or an error code to indicate failure
    }
  }

  /**
   * Sends a file to the server.
   *
   * @param {type} file - The file to be sent.
   * @param {type} server - The server to send the file to.
   * @return {type} The id of the sent file.
   */
  async sendFiletoServer(fileurl, servertosend, filename) {
    if (!this.connected) {
      console.log("Not connected to any server");
    }
      try {
      const server = this.servers.find((server) => {
        return server.name === servertosend.name && server.connected;
      });
      if (!server) {
        console.log("No server available");
        return;
      }
      const serverConnection = server.connection;
      const id = Math.floor(Math.random() * 1000);
      const tasktosend = {
        id: id,
       file: true,
        type: "file",
        message: "File submitted",
        task: fileurl,
        filename: filename,
        server: server.name,
      };

      this.running_tasks.push(tasktosend);
      serverConnection.write(JSON.stringify(tasktosend));
        return tasktosend;
      } catch (error) {
        console.error("Error during file upload:", error);
      }

      return id;
    }
  

  getTasks() {
    return this.running_tasks;
  }
  getEventEmitter() {
    return eventEmitter;
  }

  getServers() {
    return this.servers;
  }

  getServerConnections() {
    return this.server_connections;
  }

  getConnectedServers() {
    return this.server_connections.map((server) => {
      return server;
    });
  }
}


module.exports = {
  Client: Client,
  eventEmitter: eventEmitter,
};