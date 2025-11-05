import { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, PolygonLayer } from '@deck.gl/layers';
import { EditableGeoJsonLayer, DrawRectangleMode } from '@deck.gl-community/editable-layers';

// Alabama center coordinates
const INITIAL_VIEW_STATE = {
  longitude: -86.9023,
  latitude: 32.8067,
  zoom: 4,
  pitch: 0,
  bearing: 0,
};

export default function MaskedAnimation() {
  // State for GeoJSON features (drawn rectangles)
  const [features, setFeatures] = useState({
    type: 'FeatureCollection',
    features: []
  });

  const [category, setCategory] = useState(1);
  const [isAnimating, setIsAnimating] = useState(false);

  // Handle edits - keep only the most recent rectangle
  const handleEdit = ({ updatedData }) => {
    // Only keep the last feature (most recently drawn rectangle)
    if (updatedData.features.length > 0) {
      const lastFeature = updatedData.features[updatedData.features.length - 1];
      setFeatures({
        type: 'FeatureCollection',
        features: [lastFeature]
      });
      // Start animation when rectangle is drawn
      setIsAnimating(true);
      setCategory(1);
    } else {
      setFeatures(updatedData);
      setIsAnimating(false);
    }
  };

  // Animate through categories when rectangle is drawn
  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setCategory((prevCategory) => {
        if (prevCategory >= 5) {
          return 1; // Loop back to category 1
        }
        return prevCategory + 1;
      });
    }, 1000); // Change category every 1 second

    return () => clearInterval(interval);
  }, [isAnimating]);

  // Get the rectangle for dimming
  const getSelectedRect = () => {
    if (features.features.length === 0) return null;

    const feature = features.features[0];
    if (!feature.geometry || feature.geometry.type !== 'Polygon') return null;

    const coords = feature.geometry.coordinates[0];
    const lons = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);

    return {
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    };
  };

  const selectedRect = getSelectedRect();

  // Create a base tile layer
  const baseTileLayer = new TileLayer({
    id: 'base-tile-layer',
    data: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,

    renderSubLayers: props => {
      const { boundingBox, content: image } = props.tile;

      if (!image) return null;

      return new BitmapLayer({
        data: null,
        image: props.data,
        bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
      });
    }
  });

  // WMTS Storm Surge layer - only visible when animating
  const wmtsTileLayer = isAnimating ? new TileLayer({
    id: 'wmts-tile-layer',
    data: `https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/Storm_Surge_HazardMaps_Category${category}_v3/MapServer/WMTS/tile/1.0.0/Storm_Surge_HazardMaps_Category${category}_v3/default/default028mm/{z}/{y}/{x}.png`,
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,

    renderSubLayers: props => {
      const { boundingBox, content: image } = props.tile;

      if (!image) return null;

      return new BitmapLayer({
        data: null,
        image: props.data,
        bounds: [boundingBox[0][0], boundingBox[0][1], boundingBox[1][0], boundingBox[1][1]],
      });
    }
  }) : null;

  // Helper function to create rectangle polygon coordinates
  const createRectPolygon = (rect) => {
    if (!rect) return null;
    return [[
      [rect.minLon, rect.minLat],
      [rect.maxLon, rect.minLat],
      [rect.maxLon, rect.maxLat],
      [rect.minLon, rect.maxLat],
      [rect.minLon, rect.minLat],
    ]];
  };

  // Editable layer for drawing rectangles
  const editableLayer = new EditableGeoJsonLayer({
    id: 'editable-layer',
    data: features,
    mode: DrawRectangleMode,
    selectedFeatureIndexes: [],
    onEdit: handleEdit,
    // Styling
    getFillColor: [255, 255, 255, 30],
    getLineColor: [255, 255, 0, 255],
    getLineWidth: 3,
    lineWidthMinPixels: 3,
  });

  // Create dimming overlay - covers everything except the selected area
  const dimmingLayer = selectedRect ? new PolygonLayer({
    id: 'dimming-overlay',
    data: [{
      polygon: [
        // Outer ring covering the whole world
        [
          [-180, -85],
          [180, -85],
          [180, 85],
          [-180, 85],
          [-180, -85],
        ],
        // Hole for the selected rectangle (makes it transparent/bright)
        createRectPolygon(selectedRect)[0]
      ]
    }],
    getPolygon: d => d.polygon,
    getFillColor: [0, 0, 0, 120],
    pickable: false,
  }) : null;

  const layers = [
    baseTileLayer,
    wmtsTileLayer,
    dimmingLayer,
    editableLayer,
  ].filter(Boolean);

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={{ doubleClickZoom: false }}
      layers={layers}
      getCursor={editableLayer.getCursor.bind(editableLayer)}
    />
  );
}
