import React, { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { PolygonLayer } from '@deck.gl/layers';
import { Tile3DLayer } from '@deck.gl/geo-layers';
// import { Map } from 'react-map-gl';

// const MAPBOX_TOKEN = 'your-mapbox-token'; // Replace with your token

function StormSurgeVisualization() {
    const [waterLevel, setWaterLevel] = useState(3.0);
    const [viewState, setViewState] = useState({
        longitude: -80.1918,
        latitude: 25.7617,
        zoom: 16,
        pitch: 60,
        bearing: 0
    });

    // Create a large polygon to cover the visible area
    const waterPolygon = useMemo(() => {
        const center = [viewState.longitude, viewState.latitude];
        const size = 0.05; // degrees, adjust based on zoom

        return [
            [center[0] - size, center[1] - size],
            [center[0] + size, center[1] - size],
            [center[0] + size, center[1] + size],
            [center[0] - size, center[1] + size],
            [center[0] - size, center[1] - size]
        ];
    }, [viewState.longitude, viewState.latitude]);

    // Water layer using PolygonLayer
    const waterLayer = useMemo(() => {
        return new PolygonLayer({
            id: 'water-surface',
            data: [{
                polygon: waterPolygon,
                elevation: waterLevel
            }],
            getPolygon: d => d.polygon,
            getElevation: d => d.elevation,
            getFillColor: [65, 182, 196, 180],
            getLineColor: [80, 200, 220, 200],
            lineWidthMinPixels: 1,
            extruded: true,
            wireframe: false,
            material: {
                ambient: 0.35,
                diffuse: 0.6,
                shininess: 32,
                specularColor: [255, 255, 255]
            }
        });
    }, [waterLevel, waterPolygon]);

    // Google 3D Tiles layer
    const buildingsLayer = useMemo(() => {
        return new Tile3DLayer({
            id: 'google-3d-tiles',
            data: 'https://tile.googleapis.com/v1/3dtiles/root.json',
            loadOptions: {
                fetch: {
                    headers: {
                        'X-GOOG-API-KEY': import.meta.env.VITE_GOOGLE_API_KEY // Replace with your Google API key
                    }
                }
            },
            opacity: 0.9,
            pointSize: 2
        });
    }, []);

    const layers = [buildingsLayer, waterLayer];

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <DeckGL
                viewState={viewState}
                onViewStateChange={({ viewState }) => setViewState(viewState)}
                controller={true}
                layers={layers}
            >
                {/* <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
        /> */}
            </DeckGL>

            {/* Control Panel */}
            <div style={{
                position: 'absolute',
                top: 20,
                left: 20,
                background: 'rgba(0, 0, 0, 0.8)',
                padding: '20px',
                borderRadius: '8px',
                color: 'white',
                fontFamily: 'Arial, sans-serif',
                minWidth: '250px'
            }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>Storm Surge Control</h3>

                <div style={{ marginBottom: '15px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                        Water Level: {waterLevel.toFixed(1)}m
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.1"
                        value={waterLevel}
                        onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
                        style={{ width: '100%' }}
                    />
                </div>

                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '15px' }}>
                    <p style={{ margin: '5px 0' }}>• Drag to rotate view</p>
                    <p style={{ margin: '5px 0' }}>• Scroll to zoom</p>
                    <p style={{ margin: '5px 0' }}>• Right-click drag to pan</p>
                </div>
            </div>
        </div>
    );
}

export default StormSurgeVisualization;