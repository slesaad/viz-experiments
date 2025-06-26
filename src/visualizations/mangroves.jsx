import React, { useState, useEffect, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
// import { Map } from 'react-map-gl';
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
// import Map from 'react-map-gl/mapbox';

// Initial view state
const INITIAL_VIEW_STATE = {
    longitude: 0,
    latitude: 20,
    zoom: 2,
    pitch: 0,
    bearing: 0
};

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

// Get visible items based on viewport
const getVisibleItems = (data, viewState) => {
    if (!viewState) return [];

    const { longitude, latitude, zoom } = viewState;
    const buffer = 2 / Math.pow(2, zoom - 6); // Adjust buffer based on zoom

    return data.filter(item => {
        const [lon, lat] = item.position;
        return lon >= longitude - buffer && lon <= longitude + buffer &&
            lat >= latitude - buffer && lat <= latitude + buffer;
    });
};

// Create mangrove heat map layers based on zoom level
const createMangroveHeatmap = (data, zoom) => {
    if (!data || data.length === 0) return null;
    // Continental scale (zoom 0-6): Broad heat map
    if (zoom <= 6) {
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

// Layer controls component
const LayerControls = ({ showMangroves, onToggleMangroves, opacity, onOpacityChange, zoom, itemCount }) => (
    <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-10 min-w-64">
        <h3 className="text-lg font-semibold mb-3 text-gray-800">Mangrove Data</h3>

        <div className="space-y-3">
            <label className="flex items-center space-x-2">
                <input
                    type="checkbox"
                    checked={showMangroves}
                    onChange={onToggleMangroves}
                    className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Show Mangrove Data</span>
            </label>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                    Opacity: {Math.round(opacity * 100)}%
                </label>
                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={opacity}
                    onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                    className="w-full"
                />
            </div>

            <div className="text-xs text-gray-500 space-y-1">
                <div>Zoom Level: {zoom?.toFixed(1)}</div>
                <div>Total Items: {itemCount}</div>
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    {zoom <= 6 && "Continental view - Heat map"}
                    {zoom > 6 && zoom <= 10 && "Regional view - Clustered heat map"}
                    {zoom > 10 && zoom <= 12 && "Local view - Individual markers"}
                    {zoom > 12 && "Detailed view - Satellite tiles"}
                </div>
            </div>
        </div>
    </div>
);

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
        const visibleItems = getVisibleItems(stacData, viewState);

        const layerList = [];

        // Add heat map or scatter plot layer
        const heatmapLayer = createMangroveHeatmap(stacData, currentZoom);
        if (heatmapLayer) {
            layerList.push(heatmapLayer.clone({ opacity }));
        }

        // Add COG tile layers at high zoom levels
        if (currentZoom > 12 && visibleItems.length > 0) {
            const cogLayer = createCOGLayers(visibleItems, viewState);
            if (cogLayer) {
                cogLayer.opacity = opacity;
                layerList.push(cogLayer);
            }
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
                        data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        minZoom: 0,
                        maxZoom: 19,
                        tileSize: 256,
                        renderSubLayers: props => {
                          const { boundingBox: bbox, content: image } = props.tile;

                          if (!image) return null;

                          return new BitmapLayer(props, {
                            data: null,
                            image: props.data,
                            bounds: [bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]
                          })
                        }
                      }),
                    new TileLayer({
                        id: 'mangrove-cog-dynamic',
                        data: `https://dev.openveda.cloud/api/raster/searches/ef18fe0be7abfed4fe3d6903d0b72994/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?assets=cog_default&colormap_name=ylgnbu&rescale=0%2C45&nodata=0&tile_scale=2`,
                        minZoom: 6,
                        maxZoom: 18,
                        tileSize: 256,
                        opacity: 1,
                        pickable: true,

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
                    ...layers]}
                onViewStateChange={({ viewState }) => setViewState(viewState)}
            >
                {/* <Map
                    mapStyle="mapbox://styles/mapbox/light-v11"
                    mapboxAccessToken={process.env.REACT_APP_MAPBOX_TOKEN || 'pk.eyJ1IjoiY292aWQtbmFzYSIsImEiOiJjbGNxaWdqdXEwNjJnM3VuNDFjM243emlsIn0.NLbvgae00NUD5K64CD6ZyA'} // Replace with your token
                /> */}
            </DeckGL>

            <LayerControls
                showMangroves={showMangroves}
                onToggleMangroves={(e) => setShowMangroves(e.target.checked)}
                opacity={opacity}
                onOpacityChange={setOpacity}
                zoom={viewState.zoom}
                itemCount={stacData.length}
            />

            {/* Loading indicator for tiles */}
            {viewState.zoom > 12 && (
                <div className="absolute bottom-4 left-4 bg-white px-3 py-2 rounded shadow-lg text-sm text-gray-600">
                    Loading detailed satellite data...
                </div>
            )}
        </div>
    );
};

export default MangroveMap;