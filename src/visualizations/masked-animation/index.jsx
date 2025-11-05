import { useState } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer, PolygonLayer } from '@deck.gl/layers';

// Alabama center coordinates
const INITIAL_VIEW_STATE = {
  longitude: -86.9023,
  latitude: 32.8067,
  zoom: 4,
  pitch: 0,
  bearing: 0,
};

export default function MaskedAnimation() {
  // State for rectangle drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);
  const [selectedRect, setSelectedRect] = useState(null);

  // Handle pointer events for drawing rectangle
  const handlePointerDown = (info) => {
    console.log('Pointer down at:', info.coordinate);
    if (info.coordinate) {
      setIsDrawing(true);
      setStartCoords(info.coordinate);
      setEndCoords(info.coordinate);
    }
  };

  const handlePointerMove = (info) => {
    if (isDrawing && info.coordinate) {
      setEndCoords(info.coordinate);
    }
  };

  const handlePointerUp = () => {
    if (isDrawing && startCoords && endCoords) {
      // Save the completed rectangle
      setSelectedRect({
        minLon: Math.min(startCoords[0], endCoords[0]),
        maxLon: Math.max(startCoords[0], endCoords[0]),
        minLat: Math.min(startCoords[1], endCoords[1]),
        maxLat: Math.max(startCoords[1], endCoords[1]),
      });
    }
    setIsDrawing(false);
  };

  // Create a tile layer that will be masked to Alabama's shape
  const tileLayer = new TileLayer({
    id: 'masked-tile-layer',
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

  // Create layers for the rectangle being drawn
  const drawingRectLayer = isDrawing && startCoords && endCoords ? new PolygonLayer({
    id: 'drawing-rect',
    data: [{
      polygon: createRectPolygon({
        minLon: Math.min(startCoords[0], endCoords[0]),
        maxLon: Math.max(startCoords[0], endCoords[0]),
        minLat: Math.min(startCoords[1], endCoords[1]),
        maxLat: Math.max(startCoords[1], endCoords[1]),
      })
    }],
    getPolygon: d => d.polygon,
    getFillColor: [255, 255, 255, 30],
    getLineColor: [255, 255, 255, 200],
    getLineWidth: 2,
    lineWidthMinPixels: 2,
    pickable: false,
  }) : null;

  // Create layer for the selected rectangle outline
  const selectedRectLayer = selectedRect && !isDrawing ? new PolygonLayer({
    id: 'selected-rect',
    data: [{ polygon: createRectPolygon(selectedRect) }],
    getPolygon: d => d.polygon,
    getFillColor: [255, 255, 255, 0],
    getLineColor: [255, 255, 0, 255],
    getLineWidth: 3,
    lineWidthMinPixels: 3,
    pickable: false,
  }) : null;

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
    tileLayer,
    dimmingLayer,
    drawingRectLayer,
    selectedRectLayer,
  ].filter(Boolean);

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
    />
  );
}
