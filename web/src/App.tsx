import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import About from './pages/about';
import Home from './pages/home';
//import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <Router>
    <nav>
      <ul>
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/about">About</Link>
        </li>
        {/* Add more navigation links as needed */}
      </ul>
    </nav>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      {/* Define more routes as needed */}
    </Routes>
  </Router>
  );
}

export default App;
