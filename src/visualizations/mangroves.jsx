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
                        minZoom: ZOOM_THRESHOLD - 1,
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