const Activity = require("../models/quizModel");
const { successResponse, errorResponse } = require("../models/responseModel");

// Create Activity
exports.createActivity = async (req, res) => {
  try {
    const activity = new Activity(req.body);
    await activity.save();
    res.json(successResponse(activity, "Activity created successfully"));
  } catch (error) {
    res.status(500).json(errorResponse("Failed to create activity", error.message));
  }
};

// Update Activity
exports.updateActivity = async (req, res) => {
  try {
    const updatedActivity = await Activity.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updatedActivity) {
      return res.status(404).json(errorResponse("Activity not found"));
    }

    res.json(successResponse(updatedActivity, "Activity updated successfully"));
  } catch (error) {
    res.status(500).json(errorResponse("Failed to update activity", error.message));
  }
};
