import React, { useState, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';

// Lazy load all visualizations
const AircraftER2 = lazy(() => import('./visualizations/aircraft-er2.jsx'));
// const LAZ = lazy(() => import('./visualizations/laz.jsx'));
const CalipsoCurtain = lazy(() => import('./visualizations/calipso-curtain.jsx'));
const CurtainSample = lazy(() => import('./visualizations/curtain-sample.jsx'));
const ExperimentWithShaderInjection = lazy(() => import('./visualizations/experiment-with-shader-injection.jsx'));
const FCXClone = lazy(() => import('./visualizations/FCX-clone.jsx'));
const FlightWithPolygon = lazy(() => import('./visualizations/flight-with-polygon.jsx'));
const GeoArrowLayer = lazy(() => import('./visualizations/GeoArrowLayer.jsx'));
const PlaneArcAnimation = lazy(() => import('./visualizations/plane-arc-animation.jsx'));
const PointcloudAnimation = lazy(() => import('./visualizations/pointcloud-animation.jsx'));
const TilelayerInterception = lazy(() => import('./visualizations/tilelayer-interception.jsx'));
const VertexInstanceBasedShaderInjection = lazy(() => import('./visualizations/vertex-instance-based-shader-injection.jsx'));

const visualizations = [
  // { label: 'LAZ', component: LAZ },
  { label: 'Calipso Curtain', component: CalipsoCurtain },
  { label: 'FCX Clone', component: FCXClone },
  { label: 'Curtain Sample', component: CurtainSample },
  { label: 'Aircraft ER2', component: AircraftER2 },
  { label: 'Flight with Polygon', component: FlightWithPolygon },
  { label: 'Plane Arc Animation', component: PlaneArcAnimation },
  { label: 'Shader Injection', component: ExperimentWithShaderInjection },
  // { label: 'GeoArrow Layer', component: GeoArrowLayer },
  { label: 'Pointcloud Animation', component: PointcloudAnimation },
  { label: 'Tilelayer Interception', component: TilelayerInterception },
  { label: 'Vertex Instance Shader', component: VertexInstanceBasedShaderInjection },
];

export default function App() {
  const [activeViz, setActiveViz] = useState(visualizations[0].label);

  const CurrentVisualization = visualizations.find(v => v.label === activeViz)?.component || visualizations[0].component;

  return (
    <div className="app-container">
      <Sidebar data={visualizations} active={activeViz} onChange={setActiveViz} />
      <main className="main-content">
        <Suspense fallback={<div>Loading...</div>}>
          <CurrentVisualization />
        </Suspense>
      </main>
    </div>
  );
} 