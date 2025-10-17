/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

const locationUrl = "https://lydix.de/friendsmap";
// Global variables
let map = null;
let markers = [];
let isLocationEnabled = false;
let deviceId = null;

// Wait for the deviceready event before using any of Cordova's device APIs.
document.addEventListener("deviceready", onDeviceReady, false);

function generateDeviceId() {
  // Try to get device UUID first, fallback to generated ID
  if (window.device && window.device.uuid) {
    return window.device.uuid;
  }

  // Generate a unique ID based on timestamp and random number
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `device_${timestamp}_${random}`;
}

function initializeMap() {
  if (!map && typeof L !== "undefined") {
    try {
      // Initialize map with default view (London) if no location available
      map = L.map("map").setView([52.5094253, 13.4726497], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      console.log("Map initialized successfully");
    } catch (error) {
      console.error("Error initializing map:", error);
      updateLocationStatus("Map initialization failed", "error");
    }
  } else if (typeof L === "undefined") {
    console.error("Leaflet library not loaded");
    updateLocationStatus("Map library not loaded", "error");
  }
}

function onDeviceReady() {
  deviceId = generateDeviceId();
  console.log("Device ID:", deviceId);
  initializeMap();
  mainloop();
}

// Promisify geolocation
function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function mainloop() {
  updateLocationStatus("Getting your location...", "loading");

  try {
    // Get current position
    const position = await getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 300000, // 5 minutes
    });
    await onLocationSuccess(position);
  } catch (error) {
    onLocationError(error);
  }
}

async function onLocationSuccess(position) {
  console.log("Location found:", position);
  updateLocationStatus("Location found", "success");
  try {
    const { longitude, latitude } = position.coords;
    if (!map && typeof L !== "undefined") {
      map = L.map("map").setView([latitude, longitude], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      console.log("Map initialized with location");
    } else if (map) {
      map.setView([latitude, longitude], 13);
    } else {
      console.error("Leaflet library not available");
      updateLocationStatus("Map library not available", "error");
      return;
    }
    updateLocationStatus(`${longitude}, ${latitude}`, "success");

    const response = await fetch(`${locationUrl}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: deviceId,
        location: { longitude, latitude },
      }),
    });

    updateLocationStatus(`Status: ${response.status}`, "success");
    const locations = await response.json();
    await updateLocations(locations);
  } catch (error) {
    console.error("Error updating locations:", error);
    updateLocationStatus(`Network error: ${error.message}`, "error");
  }
}

async function updateLocations(locations) {
  try {
    updateLocationStatus("removing markers", "success");
    for (const marker of markers) {
      map.removeLayer(marker);
    }
    markers = [];
    updateLocationStatus("creating markers", "success");
    for (const [name, { location, lastSeen }] of Object.entries(locations)) {
      const marker = L.marker([location.latitude, location.longitude]).addTo(
        map
      );
      marker
        .bindPopup(`<b>${name}</b><br>${new Date(lastSeen).toLocaleString()}`)
        .openPopup();
      markers.push(marker);
    }
    setTimeout(() => mainloop(), 10 * 1000);
  } catch (error) {
    console.error("Error updating locations:", error);
    updateLocationStatus(error.message, "error");
  }
}

function onLocationError(error) {
  const button = document.getElementById("getLocationBtn");
  let errorMessage = "Unknown error occurred";

  switch (error.code) {
    case error.PERMISSION_DENIED:
      errorMessage =
        "Location access denied. Please enable location permissions in your device settings.";
      break;
    case error.POSITION_UNAVAILABLE:
      errorMessage =
        "Location information unavailable. Please check your GPS settings.";
      break;
    case error.TIMEOUT:
      errorMessage = "Location request timed out. Please try again.";
      break;
  }

  console.error("Location error:", error);

  // Update status with error
  updateLocationStatus(errorMessage, "error");

  // Re-enable button
  button.disabled = false;
  button.textContent = "Get My Location";
}

function updateLocationStatus(message, type = "", coordinates = "") {
  const statusElement = document.getElementById("locationStatus");

  // Clear previous classes
  statusElement.className = "";

  // Add type class if specified
  if (type) {
    statusElement.classList.add(type);
  }

  // Update content
  statusElement.innerHTML = message;

  // Add coordinates if provided
  if (coordinates) {
    const coordDiv = document.createElement("div");
    coordDiv.className = "coordinates";
    coordDiv.innerHTML = coordinates;
    statusElement.appendChild(coordDiv);
  }
}

// Handle app pause/resume
document.addEventListener(
  "pause",
  function () {
    console.log("App paused");
  },
  false
);

document.addEventListener(
  "resume",
  function () {
    console.log("App resumed");
  },
  false
);
