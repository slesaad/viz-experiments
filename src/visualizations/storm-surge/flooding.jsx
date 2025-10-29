import React, { useState, useEffect, useMemo, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { TileLayer, Tile3DLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import SurgeWaterLayer from './WaterMesh';


const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// WMTS endpoint for storm surge data
const WMTS_URL = 'https://tiles.arcgis.com/tiles/C8EMgrsFcRFL6LrL/arcgis/rest/services/Storm_Surge_HazardMaps_Category2_v3/MapServer/WMTS/tile/1.0.0/Storm_Surge_HazardMaps_Category2_v3/default/default028mm/{z}/{y}/{x}.png';


// Create a plane mesh for water surface
function createWaterMesh(bounds, segments) {
  const { west, south, east, north } = bounds;
  const positions = [];
  const normals = [];
  const texCoords = [];
  const indices = [];

  for (let y = 0; y <= segments; y++) {
    for (let x = 0; x <= segments; x++) {
      const u = x / segments;
      const v = y / segments;

      const lng = west + (east - west) * u;
      const lat = south + (north - south) * v;

      positions.push(lng, lat, 0);
      normals.push(0, 0, 1);
      texCoords.push(u, v);
    }
  }

  for (let y = 0; y < segments; y++) {
    for (let x = 0; x < segments; x++) {
      const a = y * (segments + 1) + x;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;

      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  return {
    attributes: {
      positions: { value: new Float32Array(positions), size: 3 },
      normals: { value: new Float32Array(normals), size: 3 },
      texCoords: { value: new Float32Array(texCoords), size: 2 }
    },
    indices: { value: new Uint32Array(indices), size: 1 }
  };
}


function StormSurgeVisualization() {
  const [time, setTime] = useState(0);
  const [viewState, setViewState] = useState({
    longitude: -80.1918,
    latitude: 25.7617,
    zoom: 15,
    pitch: 60,
    bearing: 0
  });

  const [showRasterOverlay, setShowRasterOverlay] = useState(true);

  const [surgeTexture, setSurgeTexture] = useState(null);
  const [surgeTextureGPU, setSurgeTextureGPU] = useState(null);
  const [textureUpdateTrigger, setTextureUpdateTrigger] = useState(0);
  const [textureBounds, setTextureBounds] = useState([0, 0, 0, 0]);

  const deckRef = useRef(null);
  const canvasRef = useRef(null);

  const [glContext, setGLContext] = useState(null); // store GL once ready

  const [visibleTiles, setVisibleTiles] = useState([]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setTime(t => t + 16);
      requestAnimationFrame(animate);
    };
    const animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, []);

  // Composite visible tiles into single texture
  useEffect(() => {
    if (visibleTiles.length === 0) return;

    // Create canvas to composite tiles
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
      canvasRef.current.width = 1024;
      canvasRef.current.height = 1024;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Find bounds of all visible tiles
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    visibleTiles.forEach(tile => {
      const { west, south, east, north } = tile.bbox;
      minX = Math.min(minX, west);
      minY = Math.min(minY, south);
      maxX = Math.max(maxX, east);
      maxY = Math.max(maxY, north);
    });

    // Draw each tile at correct position
    console.log(`Compositing ${visibleTiles.length} tiles into canvas`);
    let tilesDrawn = 0;

    visibleTiles.forEach((tile, index) => {
      if (!tile.image) {
        return;
      }

      const { west, south, east, north } = tile.bbox;
      const x = ((west - minX) / (maxX - minX)) * canvas.width;
      const y = ((maxY - north) / (maxY - minY)) * canvas.height;
      const w = ((east - west) / (maxX - minX)) * canvas.width;
      const h = ((north - south) / (maxY - minY)) * canvas.height;

      ctx.drawImage(tile.image, x, y, w, h);
      tilesDrawn++;
    });

    console.log(`Drew ${tilesDrawn} tiles to canvas`);

    // Store texture bounds for shader
    setTextureBounds([minX, minY, maxX, maxY]);

    // Set the canvas and trigger texture update
    setSurgeTexture(canvas);
    setTextureUpdateTrigger(prev => prev + 1);

    // Copy to debug canvas
    const debugCanvas = document.getElementById('debug-canvas');
    if (debugCanvas) {
      const debugCtx = debugCanvas.getContext('2d');
      debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
      debugCtx.drawImage(canvas, 0, 0, debugCanvas.width, debugCanvas.height);
    }

  }, [visibleTiles]);

  useEffect(() => {
    if (!surgeTexture) return; // HTMLCanvasElement or ImageBitmap
    const deck = deckRef.current?.deck;
    const device = deck?.device;
    if (!device) return;



    // 1. Create empty GPU texture
    const texture = device.createTexture({
      label: 'surge-texture',
      format: 'rgba8unorm',          // ✅ same as IconManager
      width: surgeTexture.width,
      height: surgeTexture.height,
      sampler: {
        minFilter: 'linear',         // ✅ same as IconManager DEFAULT_SAMPLER_PARAMETERS
        magFilter: 'linear',
        mipmapFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge'
      },
      mipmaps: true                  // ✅ allow mipmap regen
    });

    // 2. Upload the actual canvas/image into it
    texture.copyExternalImage({
      image: surgeTexture,           // HTMLCanvasElement
      x: 0,
      y: 0,
      width: surgeTexture.width,
      height: surgeTexture.height
    });

    // 3. Regenerate mipmaps (same as IconManager)
    // @ts-expect-error v9 missing types
    texture.generateMipmap?.();

    console.log("Surge texture created", texture);
    setSurgeTextureGPU(texture);

    return () => texture.destroy();
  }, [surgeTexture, textureUpdateTrigger]);



  useEffect(() => {
    if (!deckRef.current) return;

    const deck = deckRef.current.deck;

    if (deck && deck.gl) {
      console.log("GL ready!");
      setGLContext(deck.gl);
    } else {
      // If gl is not ready immediately, try again on next animation frame
      const id = requestAnimationFrame(() => {
        if (deck.gl) setGLContext(deck.gl);
      });
      return () => cancelAnimationFrame(id);
    }
  }, [deckRef]);

  // Calculate mesh bounds based on viewport
  const meshBounds = useMemo(() => {
    const zoom = viewState.zoom;
    const size = 0.2 / Math.pow(2, zoom - 11); // Scale with zoom

    return {
      west: viewState.longitude - size,
      east: viewState.longitude + size,
      south: viewState.latitude - size,
      north: viewState.latitude + size
    };
  }, [viewState.longitude, viewState.latitude, viewState.zoom]);

  // Create water mesh
  const waterMesh = useMemo(() => {
    return createWaterMesh(meshBounds, 150); // 150x150 grid for smooth appearance
  }, [meshBounds]);

  // WMTS Tile Layer (for loading texture data)
  const wmtsLayer = useMemo(() => {
    return new TileLayer({
      id: 'wmts-surge-tiles',
      data: WMTS_URL,
      minZoom: 0,
      maxZoom: 14,
      tileSize: 256,

      renderSubLayers: props => {
        const { tile } = props;

        if (!props.data || !tile) return null;

        const { west, south, east, north } = tile.bbox;

        return new BitmapLayer({
          ...props,
          id: `${props.id}-bitmap`,
          image: props.data,
          bounds: [west, south, east, north],
          visible: showRasterOverlay,
          opacity: 0.5
        });
      },

      getTileData: async ({ index }) => {
        const { x, y, z } = index;
        const url = WMTS_URL
          .replace('{z}', z)
          .replace('{x}', x)
          .replace('{y}', y);

        return new Promise((resolve) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';

          image.onload = () => {
            resolve(image);
          };

          image.onerror = () => {
            resolve(null);
          };

          image.src = url;
        });
      },

      onViewportLoad: (tiles) => {
        // Update visible tiles for texture compositing
        const loadedTiles = tiles
          .filter(tile => tile.content)
          .map(tile => ({
            bbox: tile.bbox,
            image: tile.content,
            index: tile.index
          }));

        setVisibleTiles(loadedTiles);
      }
    });
  }, [showRasterOverlay]);

  // Water mesh layer with custom shaders
  const waterLayer = useMemo(() => {
    if (!surgeTexture) return null;

    return new SurgeWaterLayer({
      id: 'surge-water-mesh',
      data: [{ position: [0, 0, 10] }],
      mesh: waterMesh,
      getPosition: d => d.position,
      // getColor: d => [255, 0, 0, 255],
      coordinateSystem: 1, // LNGLAT

      _instanced: false,

      parameters: {
        depthTest: true,
        blend: true,
        // blendFunc: ['SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA'],
        // blendEquation: 'FUNC_ADD'
      },

      time: time / 1000,
      waveHeight: 2.0,
      waveFrequency: 80,
      surgeTexture: surgeTextureGPU,
      hasSurgeData: !!surgeTextureGPU,
      opacity: 0.8,
      shallowWaterColor: [0, 0.2, 1.0], //[0.15, 0.25, 0.35],
      deepWaterColor: [0, 0.0 , 1.0], //[0.05, 0.1, 0.15],
      textureBounds: textureBounds,
      // wireframe: true,

      material: {
        ambient: 0.2,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [60, 64, 70]
      },
    });
  }, [time, waterMesh, surgeTexture, meshBounds, textureBounds, surgeTextureGPU]);

  // Google 3D Tiles layer
  const buildingsLayer = useMemo(() => {
    return new Tile3DLayer({
      id: 'google-3d-tiles',
      data: 'https://tile.googleapis.com/v1/3dtiles/root.json',
      loadOptions: {
        fetch: {
          headers: {
            'X-GOOG-API-KEY': GOOGLE_MAPS_API_KEY
          }
        }
      },
      opacity: 0.9,
      pointSize: 2
    });
  }, []);

  const layers = [buildingsLayer, wmtsLayer, waterLayer].filter(Boolean);
  // const layers = [wmtsLayer, waterLayer].filter(Boolean);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <DeckGL
        ref={deckRef}
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={true}
        layers={layers}
        onWebGLInitialized={(gl) => {
          setGLContext(gl)
        }}
      >
      </DeckGL>

      {/* Debug Canvas */}
      <div id="canvas-debug" style={{
        position: 'absolute',
        top: 20,
        right: 400,
        background: 'black',
        border: '2px solid #333',
        borderRadius: '8px',
        padding: '10px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 100000000
      }}>
        <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: 'white' }}>Debug Canvas:</h4>
        <div style={{ fontSize: '12px', color: 'white', marginBottom: '5px' }}>
          Canvas: {canvasRef.current ? `${canvasRef.current.width}x${canvasRef.current.height}` : 'Not created'}
        </div>
        <div style={{ fontSize: '12px', color: 'white', marginBottom: '5px' }}>
          GPU Texture: {surgeTextureGPU ? 'Created' : 'Not created'}
        </div>
        <div style={{
          border: '1px solid #ccc',
          display: 'inline-block'
        }}>
          <canvas
            id="debug-canvas"
            width="256"
            height="256"
            style={{
              width: '256px',
              height: '256px',
              imageRendering: 'pixelated'
            }}
          />
        </div>
      </div>

      {/* Control Panel */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        background: 'rgba(0, 0, 0, 0.85)',
        padding: '20px',
        borderRadius: '8px',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        minWidth: '300px',
        maxWidth: '350px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '18px' }}>
          Storm Surge Visualization
        </h3>

        {/* Status */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '13px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Water Mesh:</strong>
            <span style={{
              color: surgeTexture ? '#4CAF50' : '#FFB74D',
              marginLeft: '8px'
            }}>
              {surgeTexture ? '✓ Active' : '⟳ Loading...'}
            </span>
          </div>
          <div>
            <strong>Loaded Tiles:</strong>
            <span style={{ color: '#2196F3', marginLeft: '8px' }}>
              {visibleTiles.length}
            </span>
          </div>
        </div>

        {/* Toggle Raster Overlay */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            fontSize: '14px'
          }}>
            <input
              type="checkbox"
              checked={showRasterOverlay}
              onChange={(e) => setShowRasterOverlay(e.target.checked)}
              style={{
                marginRight: '10px',
                width: '16px',
                height: '16px',
                cursor: 'pointer'
              }}
            />
            Show Original Raster Overlay
          </label>
        </div>

        {/* Features */}
        <div style={{
          background: 'rgba(33, 150, 243, 0.15)',
          padding: '12px',
          borderRadius: '6px',
          marginBottom: '15px',
          fontSize: '12px',
          lineHeight: '1.7'
        }}>
          <strong style={{ color: '#2196F3' }}>Features:</strong><br />
          ✓ Continuous water mesh<br />
          ✓ Animated wave ripples<br />
          ✓ Texture-sampled surge depths<br />
          ✓ Realistic water shader<br />
          ✓ Depth-based coloring
        </div>

        {/* Info */}
        <div style={{
          fontSize: '11px',
          color: '#bbb',
          lineHeight: '1.6'
        }}>
          <strong style={{ color: '#fff' }}>How it works:</strong><br />
          • WMTS tiles loaded as texture<br />
          • Mesh vertices sample colors<br />
          • Colors → surge heights<br />
          • Wave shaders add ripples
        </div>

        <div style={{
          fontSize: '11px',
          color: '#666',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid rgba(255,255,255,0.1)'
        }}>
          <strong>Controls:</strong> Drag • Scroll • Right-click
        </div>
      </div>
    </div>
  );
}

export default StormSurgeVisualization;
