const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const courseSchema = new Schema({
    courseName: {
        type: String,
        required: true,
        trim: true
    },
    courseCode: {
        type: String,
        required: true,
        trim: true
    },
    lecturerId: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    students: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }]
} ,{timestamps: true});

module.exports = mongoose.model('Course', courseSchema);