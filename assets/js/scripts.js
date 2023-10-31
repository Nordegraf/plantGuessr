---
---


var species = null;
var score = 0;
var numspecies = 114800; // number of species in the plantGuessrData repo

// variables for painting the solution
var map = null;
var marker = null;
var countries = null;
var line = null;
var closestPoint = null;

var mapsol = null;

var game = {
    "map": null,
    "marker": null,
    "countries": null,
    "line": null,
    "closestPoint": null,
    "mapsol": null,
    "numspecies": 114800,  // number of species in the plantGuessrData repo
}

var score = {
    "total": 0,
    "rounds": []
}

function createGame() {
}

function initMap() {

}

game();

function game() {
    $(document).ready(function() {

        // to start the game the following must be done:
        // 1. getting user consent for OpenStreetMap and iNaturalist
        // 2. loading the json data for the species and their distribution
        // 3. beginning the first round
        var countries_load = load_countries();
        var consent = Promise.resolve(get_consent());

        loading([consent, countries_load]);

        // wait for 1 and 2 to resolve
        Promise.all([consent, countries_load]).then(function() {
            init_game();

            var num_rounds = 5;

            round()

            $("#next").click(function() {
                $("#name").hide();
                $("#next").hide();
                num_rounds--;

                if (marker !== null) {
                    map.removeLayer(marker);
                    map.removeLayer(mapsol);
                    map.removeLayer(line);
                }

                if (num_rounds > 0) {
                    round();
                } else {
                    end_game();
                }
            });

            $("#restart").click(function() {
                window.location.reload();
            });
        });

    });
}

function end_game() {
    $("#score").hide();
    $("#end").show();
    $("#end-score-value").text(score);
}

function resizeMapWindow() {
    if ($("#map").hasClass("large")) {
        $("#map").removeClass("large");
        $("#map").addClass("small");
    } else {
        $("#map").removeClass("small");
        $("#map").addClass("large");
    }
}



function init_game() {
    $("#game").show();

    map = L.map('map', {
        zoomControl: false,
        zoomSnap: 0.1,
        minZoom: 2,
        zoomDelta: 0.1,
        wheelPxPerZoomLevel: 300,
    }).setView([0, 0], 2);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // stop click on custom control propagating to map
    $(".leaflet-control-resize").click(function(e) {
        e.stopPropagation();
    });

    // custom control for resizing the map
    L.Control.resize = L.Control.extend({
        onAdd: function(map) {
            this._div = L.DomUtil.create('div', 'leaflet-control-resize');
            L.DomEvent.disableClickPropagation(this._div);
            this._div.innerHTML = '<i class="fas fa-up-right-and-down-left-from-center expand"></i>';
            this._div.onclick = resizeMapWindow;
            map.invalidateSize();
            return this._div;
        }
    });

    L.control.resize = function(opts) {
        return new L.Control.resize(opts);
    }

    L.control.resize({
        position: 'topleft'
    }).addTo(map);

    map.setMaxBounds([[-90, -180], [90, 180]]);
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
        noWrap: true
    }).addTo(map);

    // add countries
    L.geoJSON(countries, {
        style: function(feature) {
            return {
                color: "#000000",
                weight: 1,
                fillOpacity: 0.0
            };
        }
    }).addTo(map);

    const resizeObserver = new ResizeObserver(entries => {
        map.invalidateSize();
    });

    resizeObserver.observe(document.getElementById('map'));
}

// wait for user to click cookie consent
function get_consent() {
    return new Promise(function(resolve, reject) {
        // check if cookie is set
        if (document.cookie.indexOf("consent=true") >= 0) {
            $("#cookie-banner").hide();
            resolve();
        }

        $("#cookies").click(function() {
            resolve();

            document.cookie = "consent=true; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/"

            $("#cookie-banner").hide();
        });
    });
};

function round() {
    // get random species
    isp = Math.floor(Math.random()*numspecies);

    // wait for nobs promise to resolve
    var nobs = get_data(isp);//dummy_img();

    Promise.resolve(nobs).then(function() {
        //add marker on click, remove old marker if it exists
        map.on('click', addMarker);

        function addMarker(e){
            marker = L.marker(e.latlng).addTo(map);
            solc = get_solution_geojson(countries, species.c);
            showName(species.s);
            color_solution(solc);
            var dist = calculate_distance(e.latlng.lat, e.latlng.lng, solc);
            guessLine(e, closestPoint, dist);
            update_score(dist);
            $("#next").show();
            map.off('click', addMarker);
        }
    });
}

function calculate_distance(lat, lon, sol) {
    var guess = turf.point([lon, lat]);

    var dist = 100000000;

    // for each line in a polygon calculate the distance to the guess
    sol.features.forEach(function(country) {

        if (turf.booleanPointInPolygon(guess, country)) {
            dist = 0;
            closestPoint = guess;
            return;
        }

        var lines = turf.flatten(turf.polygonToLineString(country));

        lines.features.forEach(function(line) {
            var d = turf.pointToLineDistance(guess, line);
            if (d < dist) {
                dist = d;
                closestPoint = turf.nearestPointOnLine(line, guess);
            }
        });
    });

    return dist;
}

function get_solution_geojson(countries, solution) {
    console.log(solution);

    var features = countries.features.filter(function(country) {
        return solution.includes(country.properties.ISO);
    });

    var collection = turf.featureCollection(features);

    return collection;
}

function color_solution(sol) {
    mapsol = L.geoJSON(sol, {
        style: function(feature) {
            return {
                color: "#ff0000",
                weight: 2,
                fillOpacity: 0.2
            };
        }
    }).addTo(map);

}

function guessLine(guess, closestPoint, dist) {
    line = new L.Geodesic([guess.latlng, [closestPoint.geometry.coordinates[1], closestPoint.geometry.coordinates[0]]]).addTo(map);
    line.setStyle({
        color: "#0000ff",
        weight: 2
    });
}

function update_score(dist) {
    score += calculate_score(dist);
    $("#score").text(score);
}

function calculate_score(dist) {
    var max_score = 5000;
    var min_dist = 0;
    var max_dist = 2000;

    // score is max_score at min_dist, 0 at max_dist
    var score = Math.round(Math.min(Math.max(max_score * (1 - (dist - min_dist) / (max_dist - min_dist)), 0), max_score), 0);

    return score;
}

function get_data(isp){
    var request = "https://nordegraf.github.io/plantGuessrData/json/species_" + isp + ".json";

    var nobs = $.getJSON(request, function(data) {
        species = data;

        // get image urls
        var imgs = [];
        for (var i = 0; i < data.n.length; i++) {
            imgs.push("https://inaturalist-open-data.s3.amazonaws.com/photos/" + data.n[i] + "/original." + data.i[i]);
        }

        $("#images").empty();

        for (var i = 0; i < imgs.length; i++) {

            var author = data.r[i];
            var license = data.l[i];
            var active = (i == 0) ? " active" : "";
            var img = $("<img />").attr('src', imgs[i]).addClass('d-block plant-img');

            $("#images").append(`<div class='carousel-item${active}' id='plant-${i}'>
            <div class="image-container">
            ${img.prop('outerHTML')}
            <div class="attribution">
                <span class="attribution">${author} | ${licenseAnchor(license)}</span>
            </div>
            </div>
            </div>`);
        }

        imageLoader();

        if (imgs.length > 1) {
            $(".carousel-control-prev").show();
            $(".carousel-control-next").show();
        } else {
            $(".carousel-control-prev").hide();
            $(".carousel-control-next").hide();
        }
    });

    return nobs;
}

function licenseAnchor(license) {

    var link = "";
    if (license == "CC0 1.0") {
        link = "https://creativecommons.org/publicdomain/zero/1.0/";
    } else if (license == "CC BY 4.0") {
        link = "https://creativecommons.org/licenses/by/4.0/";
    } else if (license == "CC BY-NC 4.0") {
        link = "https://creativecommons.org/licenses/by-nc/4.0/";
    }

    return `<a href="${link}" class="license">${license}</a>`;

}

function imageLoader() {
    var loaded = 0;
    numImages = $(".plant-img").length;
    $("#imageloader").show();

    // show loader while images are loading
    $(".plant-img").on('load', function() {
        loaded++;
        if (loaded == numImages) {
            $("#imageloader").hide();
        }
    });
}

function resize_map() {
    var height = $(window).height();
    $("#map").height(height);
}

function showName(name) {
    // enter name
    $("#name").text(name).show();
}

function load_countries() {
    var loading_countries = $.getJSON("{{ "/assets/data/countries.geojson" | relative_url }}", function(data) {
        countries = data;
    });

    return loading_countries;
}

function loading(promises) {
    $("#loader").show();

    Promise.all(promises).then(function() {
        $("#loader").hide();
    });
}

function showInfo() {
    var info = $(".infotext");

    if (info.hasClass("expanded")) {
        info.removeClass("expanded");
    } else {
        info.addClass("expanded");
    }
}

$(document).ready(function() {
    $(".infobutton").on('click', function() {
        showInfo();
    });

});