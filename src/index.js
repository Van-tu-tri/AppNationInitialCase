const express = require("express");
const dotenv = require("dotenv").config();
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const app = express();

//Middleware
app.use(express.json());

//Routes
app.use("/weatherApp/auth", authRoutes);
app.use("/weatherApp", userRoutes);

//Start the server
const PORT = process.env.PORT || 7002
app.listen(PORT, () => {
    console.log(`Server is running at port ${PORT}`);
})