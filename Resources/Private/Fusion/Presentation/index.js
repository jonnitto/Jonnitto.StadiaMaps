import {
    globalSettings,
    getMapCanvas,
    getAddresses,
    getLatLngEditors,
    updateLatLngEditors,
    initFrontend,
    initBackend,
} from "carbon-geomap";

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

function initFunction({ element, live }) {
    const settings = { ...globalSettings.mapOptions, ...JSON.parse(element.dataset?.map || null) };
    const canvas = getMapCanvas(element);
    const markerCollection = [];
    const addresses = getAddresses(canvas);
    const numberOfAddresses = addresses.length;
    const inEditMode = !live && numberOfAddresses === 1;
    const zoom = settings.defaultZoom || live ? 14 : 16;

    if (!settings.center) {
        settings.center = { lng: 0, lat: 0 };
    }

    if (globalSettings.setRTLTextPlugin) {
        setRTLTextPlugin(
            "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js",
            null,
            true // Lazy load the plugin
        );
    }

    const mapSettings = {
        ...settings,
        container: canvas,
        style,
        zoom,
        center: [settings.center.lng, settings.center.lat],
    };

    map = new Map(mapSettings);

    map.addControl(new NavigationControl());

    addresses.forEach((address) => {
        // Construct a marker and set it's coordinates

        const marker = new Marker({ color: globalSettings.pinColor, draggable: !live });
        marker.setLngLat([address.lng, address.lat]);

        console.log({ address });
        if (address.popup) {
            const popup = new Popup({ closeButton: false, maxWidth: null });
            popup.setHTML(address.html);

            // Set the marker's popup.
            marker.setPopup(popup);
        }

        // Finally, we add the marker to the map.
        marker.addTo(map);

        markerCollection.push(marker);

        if (inEditMode) {
            // Wait for the Neos UI
            setTimeout(() => {
                const EDITORS = getLatLngEditors(element);
                if (EDITORS) {
                    marker.on("drag", () => {
                        const lngLat = marker.getLngLat();
                        updateLatLngEditors(EDITORS, lngLat);
                    });
                }
            }, 10);
        }
    });

    if (numberOfAddresses > 1) {
        const firstBound = markerCollection[0].getLngLat();
        const secondBound = markerCollection[1].getLngLat();
        const bounds = new LngLatBounds(firstBound, secondBound);

        const numberOfTheRest = numberOfAddresses - 2;

        for (let i = 0; i < numberOfTheRest; i++) {
            bounds.extend(markerCollection[i + 2].getLngLat());
        }

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
        })
    );

    setTimeout(() => {
        element.style.visibility = "visible";
    }, 50);
}

export { initFunction, initFrontend, initBackend };
