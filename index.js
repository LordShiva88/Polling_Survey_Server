const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.get('/', (req, res)=>{
  res.send('Polling Survey is Running')
})

app.listen(port, ()=>{
  console.log(`Server is running with port ${port}`)
})