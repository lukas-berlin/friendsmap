const locationUrl = "https://lydix.de/friendsmap";
let map = null;
let markers = [];
let arrows = []; // Store arrow polylines
let isLocationEnabled = false;
let deviceId = null;
let lastMyPosition = null; // Track previous position for movement calculation

// Settings variables
let settings = {
  updateInterval: 10,
  showArrows: true,
  followMode: "delta",
  locationAccuracy: true,
  deviceName: "",
};

// Wait for the deviceready event before using any of Cordova's device APIs.
document.addEventListener("deviceready", onDeviceReady, false);

// Settings modal functionality
document.addEventListener("DOMContentLoaded", function () {
  const settingsButton = document.getElementById("settingsButton");
  const settingsModal = document.getElementById("settingsModal");
  const closeSettings = document.getElementById("closeSettings");
  const saveSettings = document.getElementById("saveSettings");

  // Load saved settings
  loadSettings();

  // Open settings modal
  settingsButton.addEventListener("click", function () {
    settingsModal.classList.add("show");
    populateSettingsForm();
  });

  // Close settings modal
  closeSettings.addEventListener("click", function () {
    settingsModal.classList.remove("show");
  });

  // Close modal when clicking outside
  settingsModal.addEventListener("click", function (e) {
    if (e.target === settingsModal) {
      settingsModal.classList.remove("show");
    }
  });

  // Save settings
  saveSettings.addEventListener("click", function () {
    saveSettingsFromForm();
    settingsModal.classList.remove("show");
  });
});

function loadSettings() {
  const saved = localStorage.getItem("friendsmap-settings");
  if (saved) {
    settings = { ...settings, ...JSON.parse(saved) };
  }
}

function saveSettingsToStorage() {
  localStorage.setItem("friendsmap-settings", JSON.stringify(settings));
}

function populateSettingsForm() {
  document.getElementById("updateInterval").value = settings.updateInterval;
  document.getElementById("showArrows").checked = settings.showArrows;
  document.getElementById("followMode").value = settings.followMode;
  document.getElementById("locationAccuracy").checked =
    settings.locationAccuracy;
  document.getElementById("deviceName").value = settings.deviceName;
}

function saveSettingsFromForm() {
  settings.updateInterval = parseInt(
    document.getElementById("updateInterval").value
  );
  settings.showArrows = document.getElementById("showArrows").checked;
  settings.followMode = document.getElementById("followMode").value;
  settings.locationAccuracy =
    document.getElementById("locationAccuracy").checked;
  settings.deviceName = document.getElementById("deviceName").value;

  saveSettingsToStorage();
  console.log("Settings saved:", settings);
}

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
  initializeMap();
  mainloop();
}

async function mainloop() {
  while (true) {
    try {
      updateLocationStatus("Getting your location...", "loading");
      const position = await getCurrentPosition();
      updateLocationStatus(
        "Location obtained",
        "success",
        `Latitude: ${position.coords.latitude}<br>Longitude: ${position.coords.longitude}`
      );

      updateLocationStatus("Sending your location to server...", "loading");
      const locations = await sendLocation(position);
      updateLocationStatus("Location sent successfully", "success");

      updateLocationStatus("Updating map...", "loading");
      await updateMap(locations);
      updateLocationStatus("Map updated successfully", "success");
    } catch (error) {
      console.error(error);
      updateLocationStatus(error.message, "error");
    }
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 60 seconds before next update
  }
}

async function getCurrentPosition(
  options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 300000, // 5 minutes
  }
) {
  try {
    return await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  } catch (error) {
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
    throw new Error(errorMessage);
  }
}

async function sendLocation(position) {
  try {
    const { latitude, longitude } = position.coords;
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
    return locations;
  } catch (error) {
    throw new Error(`Failed to send location: ${error.message}`);
  }
}

async function updateMap(locations) {
  try {
    updateLocationStatus("updating markers", "success");

    // Create a map to track existing markers by name
    const oldMarkers = new Map();
    markers.forEach((marker) => {
      if (marker.name) {
        oldMarkers.set(marker.name, marker);
      }
    });

    let myPosition = null;

    // Process each location
    for (const [name, { location, lastSeen }] of Object.entries(locations)) {
      const oldMarker = oldMarkers.get(name);

      // Check if this is my own position
      if (name === deviceId) {
        myPosition = [location.latitude, location.longitude];
      }

      if (oldMarker) {
        // Update existing marker position
        oldMarker.setLatLng([location.latitude, location.longitude]);
        oldMarker.setPopupContent(
          `<b>${name}</b><br>${new Date(lastSeen).toLocaleString()}`
        );
        oldMarkers.delete(name); // Remove from tracking map
      } else {
        // Create new marker (without opening popup to avoid centering)
        const marker = L.marker([location.latitude, location.longitude]).addTo(
          map
        );
        marker.name = name; // Store name for tracking
        marker.bindPopup(
          `<b>${name}</b><br>${new Date(lastSeen).toLocaleString()}`
        );
        markers.push(marker);
      }
    }

    // Remove markers that no longer exist in locations
    oldMarkers.forEach((marker) => {
      map.removeLayer(marker);
      const index = markers.indexOf(marker);
      if (index > -1) {
        markers.splice(index, 1);
      }
    });

    // Keep my position visible on the map, only move map if I'm going off-screen
    if (myPosition && map) {
      const mapBounds = map.getBounds();
      const [lat, lng] = myPosition;

      // Check if my position is outside the current visible area
      if (!mapBounds.contains([lat, lng])) {
        // Pan to my position if I'm off-screen, preserving zoom
        const currentZoom = map.getZoom();
        map.setView(myPosition, currentZoom);
      }
    }
  } catch (error) {
    throw new Error(`Failed to update map: ${error.message}`);
  }
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
