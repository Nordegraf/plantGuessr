---
---

//create map object and set default positions and zoom level
resize_map();

var map = null;
var species = null;
var score = 0;
var numspecies = 114800; // number of species in the plantGuessrData repo

// variables for painting the solution
var marker = null;
var countries = null;
var line = null;
var closestPoint = null;

var mapsol = null;

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

function init_game() {
    $("#game").show();

    map = L.map('map').setView([20, 0], 2);
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
                fillOpacity: 0.1
            };
        }
    }).addTo(map);
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
    var solline = turf.lineString([ [guess.latlng.lng, guess.latlng.lat], [closestPoint.geometry.coordinates[0], closestPoint.geometry.coordinates[1]] ]);

    line = L.geoJSON(solline, {
        style: function(feature) {
            return {
                color: "#0000ff",
                weight: 2,
                fillOpacity: 0.2
            };
        }
    }).addTo(map);//.tooltip("Distance: " + Math.round(dist) + " km").bindTooltip().openTooltip().addTo(map);
}

function update_score(dist) {
    score += calculate_score(dist);
    $("#score").text(score);
}

function calculate_score(dist) {
    var max_score = 5000;
    var min_dist = 0;
    var max_dist = 1000;

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
            $("#images").append("<div class='carousel-item' id='plant-" + i + "'></div>");
        }

        for (var i = 0; i < imgs.length; i++) {
            var img = $("<img />").attr('src', imgs[i]).addClass('d-block w-100 plant-img');
            $("#plant-" + i).append(img);
        }

        imageLoader();

        if (imgs.length > 1) {
            $(".carousel-control-prev").show();
            $(".carousel-control-next").show();
        } else {
            $(".carousel-control-prev").hide();
            $(".carousel-control-next").hide();
        }

        // set carousel to first image
        $("#plant-0").addClass("active");
    });

    return nobs;
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

        console.log("loaded " + loaded + " of " + numImages)
    });
}

function resize_map() {
    var height = $(window).height();
    $("#map").height(height - 200);
    $("#plant").height(height - 200);
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