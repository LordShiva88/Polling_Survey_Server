const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const commentsCollection = client
      .db("Polling-survey")
      .collection("comments");

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, jwt_secret, (err, decoded) => {
        if (err) res.status(403).send({ message: "unauthorized access" });
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

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

    app.get("/users/role/:email", verifyToken, async (req, res) => {
      const userEmail = req.params.email;
      if (userEmail !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const filter = { email: userEmail };
      const user = await userCollection.findOne(filter);
      let role = "";
      if (user?.role === "Admin") {
        role = "Admin";
      } else if (user?.role === "Surveyor") {
        role = "Surveyor";
      } else if (user?.role === "Pro") {
        role = "Pro";
      }
      res.send({ userRole: role });
    });

    app.get("/api/v1/users", verifyToken, verifyAdmin, async (req, res) => {
      const role = req.query.role;
      let query = {};
      if (role !== "all") {
        query = { role: role };
      }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/api/v1/users/:id", async (req, res) => {
      const id = req.params.id;
      const role = req.body;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: role.role,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.delete("/api/v1/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
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

    app.get("/api/v1/surveys", async (req, res) => {
      const result = await surveysCollection.find().toArray();
      res.send(result);
    });

    app.put("/api/v1/surveys/admin/:id", async (req, res) => {
      const id = req.params.id;
      const { comment: adminFeedback, status } = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateObject = adminFeedback
        ? { status, adminFeedback }
        : { status };
      const result = await surveysCollection.updateOne(filter, {
        $set: updateObject,
      });
      res.send(result);
    });

    app.patch("/api/v1/surveys/:id", async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;
      const query = { _id: new ObjectId(id) };
      let updateFields = {};
      if (status === "like") {
        updateFields = { $inc: { like: 1 } };
      } else if (status === "dislike") {
        updateFields = { $inc: { dislike: 1 } };
      } else if (status === "report") {
        updateFields = { $inc: { report: 1 } };
      }
      const result = await surveysCollection.updateOne(query, updateFields);
      res.send(result);
    });

    app.post("/api/v1/surveys/comments", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const comment = {
        userFeedBack: data.comment,
        user_image: data.userImage,
        user_name: data.userName,
        id: data.id,
        date: data.date,
      };
      const result = await commentsCollection.insertOne(comment);
      res.send(result);
    });

    app.get("/api/v1/surveys/comments", async (req, res) => {
      const result = await commentsCollection.find().toArray();
      res.send(result);
    });

    app.put("/api/v1/surveys/surveyor/:id", async (req, res) => {
      const id = req.params.id;
      const newSurvey = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          title: newSurvey.title,
          description: newSurvey.description,
          category: newSurvey.category,
        },
      };
      const result = await surveysCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/api/v1/surveys/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await surveysCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/api/v1/surveys/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await surveysCollection.deleteOne(query);
      res.send(result);
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
