const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.rqtbidh.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const jwt_secret = process.env.JWT_SECRET_KEY;

async function run() {
  try {
    await client.connect();

    const userCollection = client.db("Polling-survey").collection("users");
    const reviewCollection = client.db("Polling-survey").collection("review");
    const surveysCollection = client.db("Polling-survey").collection("surveys");

    app.post("/api/v1/jwt", async (req, res) => {
      const user = req.body;
      const payload = { email: user.email };
      const token = jwt.sign(payload, jwt_secret, { expiresIn: "365d" });
      res.send(token);
    });

    app.post("/api/v1/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const isExist = await userCollection.findOne(filter);
      if (isExist) {
        return res.send({ message: "User already Exist" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/api/v1/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get("/api/v1/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/v1/surveys", async (req, res) => {
      const survey = req.body;
      const result = await surveysCollection.insertOne(survey);
      res.send(result);
    });

    app.get("/api/v1/surveys/:email", async (req, res) => {
      const email = req.params.email;
      const query = {email: email}
      const result = await surveysCollection.find(query).toArray()
      res.send(result)
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Polling Survey is Running");
});

app.listen(port, () => {
  console.log(`Server is running with port ${port}`);
});
