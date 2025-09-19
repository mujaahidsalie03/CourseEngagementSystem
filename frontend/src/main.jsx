import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import App from './App.jsx'; // Note the .jsx extension
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/*Wrap the App Component with the router*/}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);