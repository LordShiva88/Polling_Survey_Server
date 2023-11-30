// Import necessary modules
const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection URI
const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASS}@cluster0.rqtbidh.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoDB client
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// JWT secret key
const jwt_secret = process.env.JWT_SECRET_KEY;

async function run() {
  try {
    // await client.connect();

    // MongoDB collections
    const userCollection = client.db("Polling-survey").collection("users");
    const reviewCollection = client.db("Polling-survey").collection("review");
    const surveysCollection = client.db("Polling-survey").collection("surveys");
    const paymentsCollection = client.db("Polling-survey").collection("payments");
    const commentsCollection = client
      .db("Polling-survey")
      .collection("comments");

    // Middleware to verify JWT token
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

    // Middleware to verify admin role
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

    // Route to generate JWT token
    app.post("/api/v1/jwt", async (req, res) => {
      const user = req.body;
      const payload = { email: user.email };
      const token = jwt.sign(payload, jwt_secret, { expiresIn: "365d" });
      res.send(token);
    });

    // Route to create a new user
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

    // Route to get user role based on email
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
      } else if (user?.role === "Pro User") {
        role = "Pro User";
      }
      res.send({ userRole: role });
    });

    // Route to get all users (admin only)
    app.get("/api/v1/users", verifyToken, verifyAdmin, async (req, res) => {
      const role = req.query.role;
      let query = {};
      if (role !== "all") {
        query = { role: role };
      }
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    // Route to update user role
    app.patch("/api/v1/users/:id", verifyToken, async (req, res) => {
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

    app.patch("/api/v1/users",verifyToken, async (req, res) => {
      const {role, email} = req.body;
      const query = { email: email };
      const updateDoc = {
        $set: {
          role: role,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Route to delete a user
    app.delete("/api/v1/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    // Route to get reviews
    app.get("/api/v1/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // Route to create a new survey
    app.post("/api/v1/surveys", async (req, res) => {
      const survey = req.body;
      const result = await surveysCollection.insertOne(survey);
      res.send(result);
    });

    // Route to get surveys with optional filters and sorting
    app.get("/api/v1/surveys", async (req, res) => {
      const { category, vote, title } = req.query;
      const filter = {};
      if (category) filter.category = category;
      if (title) filter.title = title;

      let sortOptions = {};
      if (vote === "Descending") {
        sortOptions = { like: -1 };
      }
      if (vote === "Ascending") {
        sortOptions = { like: 1 };
      }
      const result = await surveysCollection
        .find(filter)
        .sort(sortOptions)
        .toArray();
      res.send(result);
    });

    // Route to update a survey by ID (admin)
    app.put("/api/v1/surveys/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
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

    // Route to participate in a survey (like, dislike, report)
    app.patch("/api/v1/surveys/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const { status, participantEmail } = req.body;
      const query = { _id: new ObjectId(id) };

      const survey = await surveysCollection.findOne(query);
      if (survey.participantEmail === participantEmail) {
        return res.send({
          message: "You have already Participated in this survey",
        });
      }
      let updateFields = {};
      if (status === "like") {
        updateFields = {
          $inc: { like: 1 },
          $set: { participantEmail: participantEmail },
        };
      } else if (status === "dislike") {
        updateFields = { $inc: { dislike: 1 } };
      } else if (status === "report") {
        updateFields = { $inc: { report: 1 } };
      }
      const result = await surveysCollection.updateOne(query, updateFields);
      res.send(result);
    });

    // Route to add comments to a survey
    app.post("/api/v1/surveys/comments", verifyToken, async (req, res) => {
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

    // Route to get comments for all surveys
    app.get("/api/v1/surveys/comments", async (req, res) => {
      const result = await commentsCollection.find().toArray();
      res.send(result);
    });

    // Route to update a survey by surveyor
    app.put("/api/v1/surveys/surveyor/:id", verifyToken, async (req, res) => {
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

    // Route to get surveys by user email
    app.get("/api/v1/surveys/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await surveysCollection.find(query).toArray();
      res.send(result);
    });

    // Route to delete a survey by ID
    app.delete("/api/v1/surveys/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await surveysCollection.deleteOne(query);
      res.send(result);
    });

    // Payment
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post('/payment', verifyToken, async(req, res)=>{
      const paymentInfo = req.body;
      const result = await paymentsCollection.insertOne(paymentInfo)
      res.send(result)
    })

    app.get('/payment',  verifyToken, verifyAdmin, async(req, res)=>{
      const result = await paymentsCollection.find().toArray()
      res.send(result)
    })

    // stats or analytics
    app.get('/admin-states', async(req, res)=>{
      const users = await userCollection.estimatedDocumentCount();
      const survey = await surveysCollection.estimatedDocumentCount();
    })

    // Ping MongoDB deployment
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
  } finally {
  }
}

// Run the MongoDB connection and start the server
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Polling Survey is Running");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running with port ${port}`);
});
