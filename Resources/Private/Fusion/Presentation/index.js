import { globalSettings, getMapCanvas, getAddresses, initFrontend } from "carbon-geomap";

import { Map, NavigationControl, Marker, Popup, LngLatBounds, setRTLTextPlugin } from "maplibre-gl";

// Style of map
const HTML = document.documentElement;
const styleSetting = globalSettings.style;
const darkModePreference = window.matchMedia("(prefers-color-scheme: dark)");
const hasDarkAndLightMode = !!(typeof styleSetting === "object" && styleSetting?.light && styleSetting?.dark);
const changeStyleBasedOnClass = hasDarkAndLightMode ? styleSetting?.basedOn === "class" : false;

// Variable for the map
let map = null;
// Variable for the style
let style = hasDarkAndLightMode ? getDynamicStyleUrl() : getStyleUrl(styleSetting);

function getStyleUrl(key) {
    return `https://tiles.stadiamaps.com/styles/${key || "outdoors"}.json`;
}

function getDynamicStyleUrl() {
    let key = styleSetting.light;
    if (
        (!changeStyleBasedOnClass && darkModePreference.matches) ||
        (changeStyleBasedOnClass && HTML.classList.contains("dark"))
    ) {
        key = styleSetting.dark;
    }
    return getStyleUrl(key);
}

function updateStyle() {
    if (!map || typeof map.setStyle != "function") {
        return;
    }
    let newStyle = getDynamicStyleUrl();
    if (newStyle !== style) {
        style = newStyle;
        map.setStyle(style);
    }
}

if (hasDarkAndLightMode) {
    if (changeStyleBasedOnClass) {
        const observer = new MutationObserver((mutationList) => {
            mutationList.forEach(function (mutation) {
                if (mutation.type === "attributes" && mutation.attributeName === "class") {
                    updateStyle();
                }
            });
        });
        observer.observe(HTML, {
            attributes: true,
        });
    } else {
        darkModePreference.addEventListener("change", updateStyle);
    }
}

function initFunction(element) {
    const inBackend = window.name == "neos-content-main";
    const settings = { ...globalSettings.mapOptions, ...JSON.parse(element.dataset?.map || null) };
    const canvas = getMapCanvas(element);
    const markerCollection = [];
    const addresses = getAddresses(canvas);
    const numberOfAddresses = addresses.length;
    const zoom = settings.defaultZoom || 14;

    if (!settings.center) {
        settings.center = { lng: 0, lat: 0 };
    }

    if (globalSettings.setRTLTextPlugin) {
        setRTLTextPlugin(
            "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js",
            null,
            true, // Lazy load the plugin
        );
    }

    const mapSettings = {
        ...settings,
        container: canvas,
        style,
        zoom,
        center: [settings.center.lng, settings.center.lat],
    };

    console.log("mapSettings", mapSettings, numberOfAddresses)

    map = new Map(mapSettings);

    map.addControl(new NavigationControl());

    addresses.forEach((address) => {
        // Construct a marker and set it's coordinates

        const marker = new Marker({ color: globalSettings.pinColor });
        marker.setLngLat([address.lng, address.lat]);

        if (address.popup) {
            const popup = new Popup({ closeButton: false, maxWidth: null });
            popup.setHTML(address.html);

            // Set the marker's popup.
            marker.setPopup(popup);
        }

        // Finally, we add the marker to the map.
        marker.addTo(map);

        markerCollection.push(marker);

        if (inBackend) {
            marker.getElement().addEventListener("click", () => {
                // this select the node in the backend
                ["mousedown", "mouseup"].forEach((event) =>
                    address.element.dispatchEvent(new Event(event, { bubbles: true })),
            });
        }
    });

    if (numberOfAddresses > 1) {
        const coord = markerCollection.map((marker) => marker.getLngLat());
        const coordinates = coord;
        const bounds = coordinates.reduce(
            (bounds, coord) => bounds.extend(coord),
            new LngLatBounds(coordinates[0], coordinates[0]),
        );
        map.fitBounds(bounds, { padding: 80, linear: true, maxZoom: zoom });
    }

    if (!numberOfAddresses) {
        console.warn("No addresses found");
        map.setCenter(settings.center);
        map.zoomTo(2);
    }

    document.dispatchEvent(
        new CustomEvent("initializedJonnittoStadiaMaps", {
            detail: {
                map,
                element,
                markers: markerCollection,
            },
        }),
    );

    setTimeout(() => {
        element.style.visibility = "visible";
    }, 50);
}

export { initFunction, initFrontend };
