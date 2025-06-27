import React, { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import Map from 'react-map-gl/mapbox';

// Initial view state
const INITIAL_VIEW_STATE = {
    longitude: 0,
    latitude: 20,
    zoom: 2,
    pitch: 0,
    bearing: 0
};

const ZOOM_THRESHOLD = 4;
// STAC API endpoint
// TODO: uncomment this
// const STAC_ENDPOINT = 'https://dev.openveda.cloud/api/stac/collections/mangrove-height-tandemx/items?limit=1500';
// For local development
const STAC_ENDPOINT = '/assets/mangroves-stac.json'; // Local file in public/

// Utility function to calculate weight from bbox
const calculateWeight = (bbox) => {
    const width = bbox[2] - bbox[0];
    const height = bbox[3] - bbox[1];
    return width * height;
};

// Process STAC items to extract centroids and metadata
const processSTACItems = async () => {
    try {
        const response = await fetch(STAC_ENDPOINT);
        const data = await response.json();

        return data.features.map(item => {
            const bbox = item.bbox;
            const centroid = [
                (bbox[0] + bbox[2]) / 2, // longitude
                (bbox[1] + bbox[3]) / 2  // latitude
            ];

            return {
                position: centroid,
                weight: calculateWeight(bbox),
                itemId: item.id,
                bbox: bbox,
                cogUrl: item.assets?.cog_default?.href
            };
        });
    } catch (error) {
        console.error('Error fetching STAC data:', error);
        return [];
    }
};

// Create mangrove heat map layers based on zoom level
const createMangroveHeatmap = (data, zoom) => {
    if (!data || data.length === 0) return null;
    // Continental scale (zoom 0-6): Broad heat map
    if (zoom <= ZOOM_THRESHOLD) {
        return new HeatmapLayer({
            id: 'mangrove-heatmap-continental',
            data: data,
            getPosition: d => d.position,
            getWeight: d => d.weight,
            radiusPixels: 60,
            intensity: 2,
            threshold: 0.05,
            colorRange: [
                [0, 128, 0, 0],     // transparent
                [0, 255, 0, 100],   // light green
                [0, 200, 0, 150],   // medium green  
                [0, 150, 0, 200],   // dark green
                [0, 100, 0, 255]    // darkest green
            ]
        });
    }
};


// Main component
const MangroveMap = () => {
    const [stacData, setStacData] = useState([]);
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const [showMangroves, setShowMangroves] = useState(true);
    const [opacity, setOpacity] = useState(0.8);
    const [loading, setLoading] = useState(true);

    // Load STAC data on component mount
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const data = await processSTACItems();
            setStacData(data);
            setLoading(false);
        };

        loadData();
    }, []);

    // Create layers based on current view state and settings
    const layers = useMemo(() => {
        if (!showMangroves || !stacData.length) return [];

        const currentZoom = viewState.zoom || 0;

        const layerList = [];

        // Add heat map or scatter plot layer
        const heatmapLayer = createMangroveHeatmap(stacData, currentZoom);
        if (heatmapLayer) {
            layerList.push(heatmapLayer.clone({ opacity }));
        }

        return layerList;
    }, [stacData, viewState, showMangroves, opacity]);

    if (loading) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading mangrove data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="relative w-full h-screen">
            <DeckGL
                initialViewState={INITIAL_VIEW_STATE}
                controller={true}
                layers={[
                    new TileLayer({
                        id: 'mangrove-cog-dynamic',
                        data: `https://dev.openveda.cloud/api/raster/searches/ef18fe0be7abfed4fe3d6903d0b72994/tiles/WebMercatorQuad/{z}/{x}/{y}@2x?assets=cog_default&colormap_name=greens&rescale=1%2C45&nodata=0&tile_scale=2`,
                        minZoom: ZOOM_THRESHOLD - 1,
                        maxZoom: 18,
                        tileSize: 512,
                        opacity: 1,
                        pickable: true,
                        maxRequests: 8,
                        renderSubLayers: (props) => {
                            const { _bbox: { west, south, east, north } } = props.tile;
                            return new BitmapLayer(props, {
                                data: null,
                                image: props.data,
                                bounds: [west, south, east, north],
                                // Apply mangrove-specific color mapping
                                colorDomain: [0, 255], // adjust based on your data range
                                colorRange: [
                                    [0, 0, 0, 0],         // transparent
                                    [34, 139, 34, 200],   // mangrove green
                                    [0, 100, 0, 255]      // dense mangrove
                                ]
                            });
                        },
                        // Add loading states
                        onTileLoad: () => {
                            // Optional: update loading state
                        }
                    }),
                    ...layers
                ]}
                onViewStateChange={({ viewState }) => setViewState(viewState)}
            >
                <Map
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                    projection="mercator"
                    mapboxAccessToken={'pk.eyJ1IjoiY292aWQtbmFzYSIsImEiOiJjbGNxaWdqdXEwNjJnM3VuNDFjM243emlsIn0.NLbvgae00NUD5K64CD6ZyA'} // Replace with your token
                />
            </DeckGL>

            {/* Colormap legend for Greens, rescale 1-63 */}
            {viewState.zoom > ZOOM_THRESHOLD && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '1rem',
                        right: '1rem',
                        background: 'rgba(255,255,255,1)',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                        minWidth: '180px',
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center'
                    }}
                >
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '4px', textAlign: 'center', width: '100%' }}>
                        Mangrove Height (m)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <span style={{ fontSize: '12px', color: '#4B5563', marginRight: '8px' }}>1</span>
                        <div
                            style={{
                                width: '120px',
                                height: '16px',
                                background: 'linear-gradient(to right, #f7fcf5 0%, #c7e9c0 25%, #74c476 50%, #238b45 75%, #00441b 100%)',
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                            }}
                        />
                        <span style={{ fontSize: '12px', color: '#4B5563', marginLeft: '8px' }}>63</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '4px', textAlign: 'center', width: '100%' }}>
                        Colormap: Greens
                    </div>
                </div>
            )}
        </div>
    );
};

export default MangroveMap;