import React from 'react';

export function Home() {
  return (
    <div className="home-container">
      <h1>Welcome to DeckGL Experiments</h1>
      <p>
        This is a collection of interactive visualizations built with DeckGL.
        Please select a visualization from the sidebar to get started.
      </p>
      <div className="features">
        <div className="feature">
          <h2>🌍 Interactive Maps</h2>
          <p>Explore various map-based visualizations with different data layers and animations.</p>
        </div>
        <div className="feature">
          <h2>✈️ Flight Tracking</h2>
          <p>View aircraft trajectories and flight paths with detailed 3D models.</p>
        </div>
        <div className="feature">
          <h2>📊 Data Visualization</h2>
          <p>Experience different ways of visualizing complex datasets using DeckGL's powerful rendering capabilities.</p>
        </div>
      </div>
    </div>
  );
}
