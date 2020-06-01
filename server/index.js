const { ApolloServer, gql } = require("apollo-server");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const UPLOAD_PATH = "/uploads";
// const UPLOAD_DIR = path.join(__dirname, UPLOAD_PATH);
const FILES = [];

const typeDefs = gql`
  type File {
    filename: String!
    mimetype: String!
    encoding: String!
    publicUri: String!
  }

  type Query {
    uploads: [File!]
  }

  type Mutation {
    uploadFiles(files: [Upload!]!): [File!]
  }
`;

const resolvers = {
  Query: {
    uploads() {
      return FILES;
    },
  },
  Mutation: {
    async uploadFiles(parent, { files }) {
      const results = [];
      try {
        for await (const file of files) {
          results.push(await saveFileToStorage(file));
        }
        return results;
      } catch (error) {
        console.error(error);
      }
      return null;
    },
  },
};

const server = new ApolloServer({ typeDefs, resolvers, cors: true });

server.listen().then(({ url, server: httpServer }) => {
  console.log(`🚀  Server ready at ${url}`);
  // httpServer.removeListener("error", httpServer.listeners("error")[0]);
  httpServer.on("error", (err) => {
    console.error("SERVER ERROR", err);
  });

  httpServer.on("request", (req, res) => {
    serveStaticFiles(req, res)
  });
});

function saveFileToStorage({ filename, mimetype, encoding, createReadStream }) {
  return new Promise((resolve, reject) => {
    const publicUri = generatePublicFileUrl(filename);
    createReadStream()
      .pipe(fs.createWriteStream(path.join(__dirname, publicUri)))
      .on("close", () => {
        const file = { filename, mimetype, encoding, publicUri };
        FILES.push(file);
        resolve(file);
      })
      .on("error", reject);
  });
}

function generateUrlFileName(filename) {
  return Math.random().toString(36).substr(2, 9) + path.extname(filename);
  // return crypto.randomBytes(20).toString('hex')
}

function generatePublicFileUrl(filename) {
  return path.join("/", UPLOAD_PATH, generateUrlFileName(filename));
}

function serveStaticFiles(req, res) {
  if (req.url.includes(UPLOAD_PATH)) {
    applyCors(req, res);
    const FILE = path.normalize(path.join(__dirname, req.url));
    try {
      const data = fs.readFileSync(FILE);
      res.writeHead(200);
      res.end(data);
    } catch (error) {
      res.writeHead(404, "INVALID REQUEST");
      res.end();
    }
    return true;
  }
  return false;
}

function applyCors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.writeHead(200);
    res.end("ok");
  }
}

function converFileStreamToBase64({
  filename,
  mimetype,
  encoding,
  createReadStream,
}) {
  return new Promise((resolve, reject) => {
    const fileReadStream = createReadStream();
    let fileBuffer = Buffer.alloc(0);
    fileReadStream.on("data", (chunk) => {
      fileBuffer = Buffer.concat([fileBuffer, chunk]);
    });
    fileReadStream.on("error", (err) => {
      console.error(err);
    });
    fileReadStream.on("end", () => {
      const r = fileBuffer.toString("base64");
      console.log(fileBuffer.toJSON().data);
      resolve(r);
    });
  });
}
