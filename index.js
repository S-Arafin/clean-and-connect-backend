\const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c3nyioy.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    
    await client.connect();
    const db = client.db("clean-and-connect-db");
    const issuesCollection = db.collection("issues");
    const contributionsCollection = db.collection("contributions");
    const usersCollection = db.collection("users");

    app.get("/stats", async (req, res) => {
        const totalUsers = await usersCollection.estimatedDocumentCount();
        const totalIssues = await issuesCollection.estimatedDocumentCount();
        res.send({ totalUsers, totalIssues });
    });

    app.post("/register", async (req, res) => {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await usersCollection.findOne(query);
        if (existingUser) {
            return res.send({ message: "User already exists", insertedId: null });
        }
        const result = await usersCollection.insertOne(user);
        res.send(result);
    });

    app.post("/issues", async (req, res) => {
        const issue = req.body;
        issue.date = new Date(); 
        const result = await issuesCollection.insertOne(issue);
        res.send(result);
    });

    app.get("/issues", async (req, res) => {
        const { search, status } = req.query;
        let query = {};
        if (search) {
            query.title = { $regex: search, $options: "i" }; 
        }
        if (status) {
            query.status = status;
        }
        const result = await issuesCollection.find(query).toArray();
        res.send(result);
    });

    app.get("/issues-recent", async (req, res) => {
        const result = await issuesCollection
            .find().sort({ date: -1 }).limit(6).toArray();
        res.send(result);
    });

    app.get("/issues/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await issuesCollection.findOne(query);
        res.send(result);
    });

    app.get("/my-issues/:email", async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const result = await issuesCollection.find(query).toArray();
        res.send(result);
    });

    app.patch("/issues/:id", async (req, res) => {
        const id = req.params.id;
        const data = req.body;
        const filter = { _id: new ObjectId(id) };
        const updatedDoc = {
            $set: {
                title: data.title,
                description: data.description,
                category: data.category,
                amount: data.amount,
                status: data.status
            }
        };
        const result = await issuesCollection.updateOne(filter, updatedDoc);
        res.send(result);
    });

    app.delete("/issues/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await issuesCollection.deleteOne(query);
        res.send(result);
    });

    app.post("/contributions", async (req, res) => {
        const contribution = req.body;
        contribution.date = new Date();
        const result = await contributionsCollection.insertOne(contribution);

        const issueId = contribution.issueId;
        const allContributions = await contributionsCollection.find({ issueId: issueId }).toArray();
        const totalRaised = allContributions.reduce((sum, item) => sum + item.amount, 0);

        const query = { _id: new ObjectId(issueId) };
        const issue = await issuesCollection.findOne(query);

        if (issue && totalRaised >= issue.amount && issue.status !== "Resolved") {
            await issuesCollection.updateOne(query, {
                $set: { status: "Resolved" }
            });
        }

        res.send(result);
    });

    app.get("/contributions/:issueId", async (req, res) => {
        const issueId = req.params.issueId;
        const query = { issueId: issueId }; 
        const result = await contributionsCollection.find(query).toArray();
        res.send(result);
    });

    app.get("/my-contributions/:email", async (req, res) => {
        const email = req.params.email;
        const query = { userEmail: email }; 
        const result = await contributionsCollection.find(query).toArray();
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
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});