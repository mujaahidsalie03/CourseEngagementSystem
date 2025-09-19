import CourseListPage from './pages/CourseListPage';
import {Routes, Route} from 'react-router-dom';
import CourseDetailPage from './pages/CourseDetailPage'; 
import StudentSessionPage from './pages/session/StudentSessionPage';

function App() {
  return (
    <div>
      <Routes>
        <Route path="/" element={<CourseListPage/>}/>
        <Route path="/course/:courseId" element={<CourseDetailPage/>}/>
        <Route path="/session/:sessionId" element={<StudentSessionPage />} />
      </Routes>
    </div>
  );
}

export default App;