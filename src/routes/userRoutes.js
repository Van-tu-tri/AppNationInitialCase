const express = require("express");
const verifyToken = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");
const {getLocationFromCity, getWeatherReportFromCity, getQueryHistory} = require("../controller/weatherController")
const router = express.Router();

// Only "role:admin" can access this, actually this is only for test.
router.get("/admin", verifyToken, authorizeRoles("admin"), (req, res) => {
    res.json({message: "This is admin page."});
});

router.get("/cityToLocation", verifyToken, getLocationFromCity);
router.get("/getWeatherReportFromCity", verifyToken, getWeatherReportFromCity);
router.get("/getQueryHistory", verifyToken, getQueryHistory);

// Everyone can access this, actually this is only for test.
router.get("/user", verifyToken, authorizeRoles("admin", "user"), (req, res) => {
    res.json({message: "This is user page."});
});

module.exports = router;