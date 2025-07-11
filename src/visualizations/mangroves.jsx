import React, { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { BitmapLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
import { IconLayer } from '@deck.gl/layers';
import {FlyToInterpolator, WebMercatorViewport} from '@deck.gl/core';
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
const STAC_ENDPOINT = 'https://dev.ghg.center/api/stac'
const RASTER_ENDPOINT = 'https://dev.ghg.center/api/raster'
const STAC_SEARCH_ENDPOINT = `${STAC_ENDPOINT}/search`
const COLLECTION_NAME = 'cms-mangrove-biomass-height-v5'
const RESPONSE_LIMIT = 10000;
// For local development
// const STAC_ENDPOINT = '/assets/mangroves-stac.json'; // Local file in public/

// Utility function to calculate weight from bbox
const calculateWeight = (bbox) => {
    const width = bbox[2] - bbox[0];
    const height = bbox[3] - bbox[1];
    return width * height;
};

// Process STAC items to extract centroids and metadata
const processSTACItems = async () => {
    try {
        const cqlFilter = {
            "filter-lang": "cql2-json",
            "filter": {
                "op": "and",
                "args": [
                    { "op": "eq", "args": [ { "property": "collection" }, COLLECTION_NAME ] }
                ]
            },
            "limit": RESPONSE_LIMIT,
            "fields": {
                "include": ["bbox"],
                "exclude": ["collection", "links"]
            }
        };
        const response = await fetch(STAC_SEARCH_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(cqlFilter)
        });
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
            };
        });
    } catch (error) {
        console.error('Error fetching STAC data:', error);
        return [];
    }
};

// Create mangrove marker layer (IconLayer) for all zoom levels
const createMangroveMarkers = (data, flyToBbox) => {
    if (!data || data.length === 0) return null;
    // return null;
    return new IconLayer({
        id: 'mangrove-markers',
        data: data,
        pickable: true,
        iconAtlas: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.png',
        iconMapping: 'https://raw.githubusercontent.com/visgl/deck.gl-data/master/website/icon-atlas.json',
        getIcon: d => 'marker',
        sizeScale: 8, // smaller
        getPosition: d => d.position,
        getSize: d => 2, // smaller
        getColor: [34, 139, 34, 255],
        getAnchor: d => 'bottom', // anchor at the bottom
        onClick: info => {
            if (info.object && info.object.bbox) {
                flyToBbox(info.object.bbox);
            }
        }
    });
};

// Utility to fit bbox (returns {longitude, latitude, zoom})
function getViewForBbox(bbox) {
  // bbox: [west, south, east, north]
  const [west, south, east, north] = bbox;
  const longitude = (west + east) / 2;
  const latitude = (south + north) / 2;
  // Rough zoom calculation: fit bounds to viewport width (assume 800px)
  // This is a simple approximation for Web Mercator
  const WORLD_DIM = 256;
  const ZOOM_MAX = 18;
  const width = Math.abs(east - west);
  const height = Math.abs(north - south);
  // Prevent log(0)
  const lngZoom = Math.log2(360 / width);
  const latZoom = Math.log2(180 / height);
  const zoom = Math.min(lngZoom, latZoom, ZOOM_MAX);
  return { longitude, latitude, zoom };
}

// Configurable threshold for bbox area (in degrees^2)
const BBOX_AREA_THRESHOLD = 10;

/**
 * Calculate the area of a bounding box.
 * @param {number[]} bbox - [west, south, east, north]
 * @returns {number} Area in degrees^2
 */
function bboxArea(bbox) {
  if (!bbox || bbox.length !== 4) return 0;
  const [west, south, east, north] = bbox;
  return Math.abs(east - west) * Math.abs(north - south);
}

/**
 * Filter STAC items by bbox area.
 * @param {Array} data - Array of STAC items with bbox property.
 * @param {number} threshold - Area threshold.
 * @param {string} op - 'gt' for greater than, 'lt' for less than.
 * @returns {Array} Filtered array.
 */
function filterByBboxArea(data, threshold, op = 'lt') {
  return data.filter(item => {
    const area = bboxArea(item.bbox);
    return op === 'lt' ? area < threshold : area > threshold;
  });
}

// --- LocalStorage Caching Utilities ---
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
function setCache(key, data, ttlMs) {
  const expires = Date.now() + ttlMs;
  localStorage.setItem(key, JSON.stringify({ data, expires }));
}
function getCache(key) {
  const cached = localStorage.getItem(key);
  if (!cached) return null;
  try {
    const { data, expires } = JSON.parse(cached);
    if (Date.now() > expires) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

// Main component
const MangroveMap = () => {
    const [stacData, setStacData] = useState([]);
    const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
    const [showMangroves, setShowMangroves] = useState(true);
    const [opacity, setOpacity] = useState(0.8);
    const [loading, setLoading] = useState(true);
    const [tilesLoading, setTilesLoading] = useState(false);
    const [tileUrl, setTileUrl] = useState(null);
    const [tileLayerReady, setTileLayerReady] = useState(false);
    const [selectedAsset, setSelectedAsset] = useState('mangrove-agb');
    const deckRef = useRef();

    // Fly to bbox with fitBounds and animation
    const flyToBbox = (bbox) => {
      if (!deckRef.current) return;
      const { width, height } = deckRef.current;
      const viewport = new WebMercatorViewport({
        width,
        height,
        ...viewState
      });
      const bounds = [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]]
      ];
      const newViewState = viewport.fitBounds(bounds, { padding: 20 });
      setViewState({
        ...viewState,
        ...newViewState,
        transitionDuration: 3000,
        transitionInterpolator: new FlyToInterpolator({ speed: 1.5 })
      });
    };

    // Load STAC data on component mount
    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            // Cache by endpoint and collection
            const stacKey = `stacData-${COLLECTION_NAME}`;
            let data = getCache(stacKey);
            if (!data) {
                data = await processSTACItems();
                setCache(stacKey, data, CACHE_TTL);
            }
            setStacData(data);
            setLoading(false);
        };
        loadData();
    }, []);

    // Fetch dynamic tile URL on mount and when selectedAsset changes
    useEffect(() => {
      async function fetchTileUrl() {
        setTileLayerReady(false);
        try {
          // 1. Register search (cache by collection)
          const registerKey = `raster-register-${COLLECTION_NAME}`;
          let registerData = getCache(registerKey);
          if (!registerData) {
            const registerResp = await fetch(`${RASTER_ENDPOINT}/searches/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                "filter-lang": "cql2-json",
                "filter": {
                  "op": "eq",
                  "args": [{ "property": "collection" }, COLLECTION_NAME]
                }
              })
            });
            registerData = await registerResp.json();
            setCache(registerKey, registerData, CACHE_TTL);
          }
          // 2. Find the tilejson link
          const tilejsonLink = registerData.links.find(link => link.rel === 'tilejson');
          if (!tilejsonLink) return;
          // 3. Replace {tileMatrixSetId} with WebMercatorQuad and use selectedAsset
          const tilejsonUrl = tilejsonLink.href.replace('{tileMatrixSetId}', 'WebMercatorQuad') + `?assets=${selectedAsset}&colormap_name=greens&rescale=1%2C45&nodata=0&tile_scale=2`;
          // 4. Fetch tilejson (cache by tilejsonUrl)
          let tilejsonData = getCache(tilejsonUrl);
          if (!tilejsonData) {
            const tilejsonResp = await fetch(tilejsonUrl);
            tilejsonData = await tilejsonResp.json();
            setCache(tilejsonUrl, tilejsonData, CACHE_TTL);
          }
          // 5. Get the first tile URL
          if (tilejsonData.tiles && tilejsonData.tiles.length > 0) {
            setTileUrl(tilejsonData.tiles[0]);
            setTileLayerReady(true);
          }
        } catch (err) {
          setTileLayerReady(false);
        }
      }
      fetchTileUrl();
    }, [selectedAsset]);

    // Create layers based on current view state and settings
    const layers = useMemo(() => {
        if (!showMangroves || !stacData.length) return [];

        const layerList = [];

        // Memoize filtered data and marker layer for efficiency
        const filteredStacData = useMemo(
          () => filterByBboxArea(stacData, BBOX_AREA_THRESHOLD, 'lt'),
          [stacData]
        );
        const markerLayer = useMemo(
          () => createMangroveMarkers(filteredStacData, flyToBbox),
          [filteredStacData, flyToBbox]
        );
        if (markerLayer && viewState.zoom < ZOOM_THRESHOLD) {
            layerList.push(markerLayer.clone({ opacity }));
        }

        return layerList;
    }, [stacData, viewState, showMangroves, opacity]);

    // Tile loading handlers
    const handleViewStateChange = ({ viewState }) => {
        setViewState(viewState);
        // Only show spinner if zoom is in tile loading range
        if (viewState.zoom >= (ZOOM_THRESHOLD)) {
            setTilesLoading(true);
        } else {
            setTilesLoading(false);
        }
    };
    const handleViewportLoad = () => {
        setTilesLoading(false);
    };

    // Asset descriptions
    const assetDescriptions = {
      'mangrove-agb': 'Aboveground biomass (AGB): Estimated mass of living plant material above the soil, measured in megagrams per hectare (Mg/ha).',
      'mangrove-hba': 'Height-based area (HBA): Area-weighted mean height of mangrove canopy, measured in meters (m).',
      'mangrove-hmax95': '95th percentile maximum height (Hmax95): The height below which 95% of mangrove canopy heights fall, measured in meters (m).'
    };

    // Asset legend titles
    const assetLegendTitles = {
      'mangrove-agb': 'Aboveground Biomass (Mg/ha)',
      'mangrove-hba': 'Height-based Area (m)',
      'mangrove-hmax95': '95th Percentile Max Height (m)'
    };

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
            {/* Asset selection radio buttons */}
            <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 50, background: 'rgba(255,255,255,0.95)', padding: '8px 16px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                <label style={{ marginRight: '12px' }}>
                    <input type="radio" name="asset" value="mangrove-agb" checked={selectedAsset === 'mangrove-agb'} onChange={() => setSelectedAsset('mangrove-agb')} /> Aboveground Biomass (AGB)
                </label>
                <label style={{ marginRight: '12px' }}>
                    <input type="radio" name="asset" value="mangrove-hba" checked={selectedAsset === 'mangrove-hba'} onChange={() => setSelectedAsset('mangrove-hba')} /> Height-based Area (HBA)
                </label>
                <label>
                    <input type="radio" name="asset" value="mangrove-hmax95" checked={selectedAsset === 'mangrove-hmax95'} onChange={() => setSelectedAsset('mangrove-hmax95')} /> 95th Percentile Max Height (Hmax95)
                </label>
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#374151', background: '#f3f4f6', borderRadius: '6px', padding: '8px', lineHeight: 1.4 }}>
                  {assetDescriptions[selectedAsset]}
                </div>
            </div>
            <DeckGL
                ref={deckRef}
                initialViewState={INITIAL_VIEW_STATE}
                viewState={viewState}
                controller={true}
                layers={[
                    tileLayerReady && tileUrl && new TileLayer({
                        id: 'mangrove-cog-dynamic',
                        data: tileUrl,
                        minZoom: ZOOM_THRESHOLD - 1,
                        maxZoom: 18,
                        tileSize: 256,
                        opacity: 1,
                        pickable: false,
                        maxRequests: 8,
                        renderSubLayers: (props) => {
                            const { _bbox: { west, south, east, north } } = props.tile;
                            return new BitmapLayer(props, {
                                data: null,
                                image: props.data,
                                bounds: [west, south, east, north],
                                colorDomain: [0, 255],
                                colorRange: [
                                    [0, 0, 0, 0],
                                    [34, 139, 34, 200],
                                    [0, 100, 0, 255]
                                ]
                            });
                        },
                        onViewportLoad: handleViewportLoad,
                    }),
                    ...layers
                ]}
                onViewStateChange={handleViewStateChange}
            >
                <Map
                    mapStyle="mapbox://styles/mapbox/dark-v11"
                    projection="mercator"
                    mapboxAccessToken={'pk.eyJ1IjoiY292aWQtbmFzYSIsImEiOiJjbGNxaWdqdXEwNjJnM3VuNDFjM243emlsIn0.NLbvgae00NUD5K64CD6ZyA'}
                />
            </DeckGL>

            {/* Small tile loading indicator in top right */}
            {tilesLoading && (
                <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'rgba(255,255,255,0.95)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#238b45',
                    fontWeight: 500
                }}>
                    <span className="deck-spinner" />
                    Loading map tiles...
                    <style>{`
                        .deck-spinner {
                            width: 14px;
                            height: 14px;
                            border: 2px solid #238b45;
                            border-top: 2px solid transparent;
                            border-radius: 50%;
                            display: inline-block;
                            animation: deck-spin 1s linear infinite;
                        }
                        @keyframes deck-spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            )}

            {/* Colormap legend for Greens, rescale 1-63 */}
            {viewState.zoom > ZOOM_THRESHOLD - 1 && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '1rem',
                        right: '1rem',
                        background: 'rgba(255,255,255,0.9)',
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
                        {assetLegendTitles[selectedAsset] || 'Legend'}
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