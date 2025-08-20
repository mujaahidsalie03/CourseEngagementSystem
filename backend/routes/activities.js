const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");

// Routes
router.post("/", activityController.createActivity);
router.put("/:id", activityController.updateActivity);

module.exports = router;
