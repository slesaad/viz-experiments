"""
Extract 3D Wind Data from GEOS NetCDF4 file
Creates a JSON file with 3D wind vectors for volumetric visualization
"""

import netCDF4 as nc
import numpy as np
import json

# Open the GEOS NetCDF4 file
file_path = 'GEOS.fp.asm.tavg3_3d_asm_Nv.20220228_0130.V01.nc4'
dataset = nc.Dataset(file_path, 'r')

print(f"Loading 3D wind data from {file_path}")

# Extract coordinates
lats = dataset.variables['lat'][:]
lons = dataset.variables['lon'][:]
lev = dataset.variables['lev'][:]  # Pressure levels

print(f"Grid size: {len(lons)} x {len(lats)} x {len(lev)}")

# US bounding box
us_west, us_east = -125, -66
us_south, us_north = 24, 49

# Find indices for US region
lat_mask = (lats >= us_south) & (lats <= us_north)
lon_mask = (lons >= us_west) & (lons <= us_east)

us_lats = lats[lat_mask]
us_lons = lons[lon_mask]

print(f"US region grid: {len(us_lons)} x {len(us_lats)} x {len(lev)}")

# Extract 3D wind data (all pressure levels)
# Shape: (time, lev, lat, lon)
u_data = dataset.variables['U'][0, :, :, :]  # Remove time dimension
v_data = dataset.variables['V'][0, :, :, :]

# OMEGA is vertical velocity in Pa/s - we can use this for W component
omega_data = dataset.variables['OMEGA'][0, :, :, :]

# Extract height data for altitude mapping
height_data = dataset.variables['H'][0, :, :, :]  # mid_layer_heights in meters

# Extract US region for all levels
# Shape is (lev, lat, lon)
us_u = u_data[:, lat_mask, :][:, :, lon_mask]
us_v = v_data[:, lat_mask, :][:, :, lon_mask]
us_omega = omega_data[:, lat_mask, :][:, :, lon_mask]
us_height = height_data[:, lat_mask, :][:, :, lon_mask]

print(f"US U shape: {us_u.shape}")
print(f"US V shape: {us_v.shape}")
print(f"US Omega shape: {us_omega.shape}")

# Select subset of pressure levels for visualization (every 4th level to reduce data size)
level_step = 4
selected_levels = list(range(0, len(lev), level_step))
print(f"Selected {len(selected_levels)} pressure levels (every {level_step}th level)")

us_u_subset = us_u[selected_levels, :, :]
us_v_subset = us_v[selected_levels, :, :]
us_omega_subset = us_omega[selected_levels, :, :]
us_height_subset = us_height[selected_levels, :, :]
selected_lev = lev[selected_levels]

# Calculate wind speed for statistics
wind_speed_3d = np.sqrt(us_u_subset**2 + us_v_subset**2 + (us_omega_subset * 0.01)**2)

print(f"\n3D Wind Statistics:")
print(f"U range: {np.nanmin(us_u_subset):.2f} to {np.nanmax(us_u_subset):.2f} m/s")
print(f"V range: {np.nanmin(us_v_subset):.2f} to {np.nanmax(us_v_subset):.2f} m/s")
print(f"Omega range: {np.nanmin(us_omega_subset):.2f} to {np.nanmax(us_omega_subset):.2f} Pa/s")
print(f"Wind speed range: {np.nanmin(wind_speed_3d):.2f} to {np.nanmax(wind_speed_3d):.2f} m/s")
print(f"Height range: {np.nanmin(us_height_subset):.2f} to {np.nanmax(us_height_subset):.2f} m")

# Prepare export data
export_data = {
    'metadata': {
        'date': '2022-02-28',
        'time': '01:30 UTC',
        'source': 'GEOS FP 3D',
        'units': 'm/s',
        'vertical_units': 'Pa/s (OMEGA)',
        'bounds': {
            'west': float(us_west),
            'east': float(us_east),
            'south': float(us_south),
            'north': float(us_north)
        },
        'grid_size': {
            'width': len(us_lons),
            'height': len(us_lats),
            'depth': len(selected_levels)
        },
        'wind_stats': {
            'u_range': [float(np.nanmin(us_u_subset)), float(np.nanmax(us_u_subset))],
            'v_range': [float(np.nanmin(us_v_subset)), float(np.nanmax(us_v_subset))],
            'omega_range': [float(np.nanmin(us_omega_subset)), float(np.nanmax(us_omega_subset))],
            'speed_range': [float(np.nanmin(wind_speed_3d)), float(np.nanmax(wind_speed_3d))],
            'mean_speed': float(np.nanmean(wind_speed_3d)),
            'height_range': [float(np.nanmin(us_height_subset)), float(np.nanmax(us_height_subset))]
        }
    },
    'lats': us_lats.tolist(),
    'lons': us_lons.tolist(),
    'levels': selected_lev.tolist(),
    'heights': np.nanmean(us_height_subset, axis=(1, 2)).tolist(),  # Average height per level
    'u': np.nan_to_num(us_u_subset, nan=0.0).tolist(),
    'v': np.nan_to_num(us_v_subset, nan=0.0).tolist(),
    'omega': np.nan_to_num(us_omega_subset, nan=0.0).tolist()
}

# Save to JSON
output_file = 'wind_data_3d_us.json'
with open(output_file, 'w') as f:
    json.dump(export_data, f)

print(f"\n✓ Exported 3D wind data to {output_file}")
print(f"  Grid: {len(us_lons)} x {len(us_lats)} x {len(selected_levels)} points")
print(f"  Ready for volumetric visualization!")

dataset.close()
