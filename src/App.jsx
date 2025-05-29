import React from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Home } from './components/Home';

// Lazy load all visualizations
const AircraftER2 = React.lazy(() => import('./visualizations/aircraft-er2.jsx'));
// const LAZ = lazy(() => import('./visualizations/laz.jsx'));
const CalipsoCurtain = React.lazy(() => import('./visualizations/calipso-curtain.jsx'));
const CurtainSample = React.lazy(() => import('./visualizations/curtain-sample.jsx'));
const ExperimentWithShaderInjection = React.lazy(() => import('./visualizations/experiment-with-shader-injection.jsx'));
const FCXClone = React.lazy(() => import('./visualizations/FCX-clone.jsx'));
const FlightWithPolygon = React.lazy(() => import('./visualizations/flight-with-polygon.jsx'));
const PlaneArcAnimation = React.lazy(() => import('./visualizations/plane-arc-animation.jsx'));
const PointcloudAnimation = React.lazy(() => import('./visualizations/pointcloud-animation.jsx'));
const TilelayerInterception = React.lazy(() => import('./visualizations/tilelayer-interception.jsx'));
const VertexInstanceBasedShaderInjection = React.lazy(() => import('./visualizations/vertex-instance-based-shader-injection.jsx'));

const visualizations = [
  // { label: 'LAZ', component: LAZ },
  { label: 'Calipso Curtain', path: '/calipso-curtain', component: CalipsoCurtain },
  { label: 'FCX Clone', path: '/fcx-clone', component: FCXClone },
  { label: 'Curtain Sample', path: '/curtain-sample', component: CurtainSample },
  { label: 'Aircraft ER2', path: '/aircraft-er2', component: AircraftER2 },
  { label: 'Flight with Polygon', path: '/flight-with-polygon', component: FlightWithPolygon },
  { label: 'Plane Arc Animation', path: '/plane-arc-animation', component: PlaneArcAnimation },
  { label: 'Shader Injection', path: '/shader-injection', component: ExperimentWithShaderInjection },
  { label: 'Pointcloud Animation', path: '/pointcloud-animation', component: PointcloudAnimation },
  { label: 'Tilelayer Interception', path: '/tilelayer-interception', component: TilelayerInterception },
  { label: 'Vertex Instance Shader', path: '/vertex-instance-shader', component: VertexInstanceBasedShaderInjection },
];

export default function App() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="app-container">
      <Sidebar data={visualizations} active={currentPath} />
      <main className="main-content">
        <React.Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            {visualizations.map(({ path, component: Component }) => (
              <Route key={path} path={path} element={<Component />} />
            ))}
          </Routes>
        </React.Suspense>
      </main>
    </div>
  );
} 