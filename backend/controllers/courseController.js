const courseRepository= require('../repositories/courseRepository');

const createCourse = async (req, res) => {
    try{
         // The controller's job is to get the data from the request
        const { courseName, courseCode, lecturerId } = req.body;
        if(!lecturerId){
            return res.status(400).json({ message: 'Lecturer ID is required.' });
        }

        //Pass it to the repository to handle the database logic.
        const newCourse = await courseRepository.create({ courseName, courseCode, lecturerId });
        res.status(201).json(newCourse);
    } catch(error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error while creating course.' });
    }
};

const getUserCourses = async(req, res) => {
    try{
        const userId = req.params.userId;

        // The controller calls the repository to fetch the data.
        const courses = await courseRepository.findByUserId(userId);
        res.json(courses);
    } catch(error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server error while fetching courses.' });
    }
};

module.exports = {
  createCourse,
  getUserCourses,
};