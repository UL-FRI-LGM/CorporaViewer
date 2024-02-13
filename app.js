require('dotenv').config();

const express = require("express");
const path = require("path");
const cors = require("cors");
// const passport = require("passport");
const bodyParser = require("body-parser");

const router = require("./api/routes/router");

const port = process.env.PORT || 3000;
const ipAddress = process.env.IP_ADDRESS || "localhost";
const app = express();

app.use(cors());
app.use(express.static(path.join(__dirname, "vue", "dist")));

app.use(bodyParser.urlencoded({ extended: false }));
app.use("/api", router);

// app.get("*", (req, res) => {
//     res.sendFile(path.join(__dirname, "vue", "dist", "index.html"));
// });

app.listen(port, ipAddress, () => {
    console.log(`Server is running on port ${port} and IP address ${ipAddress}`);
});