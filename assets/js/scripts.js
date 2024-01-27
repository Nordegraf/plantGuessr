function resizeMapWindow() {
    if ($("#map").hasClass("large")) {
        $("#map").removeClass("large");
        $("#map").addClass("small");
    } else {
        $("#map").removeClass("small");
        $("#map").addClass("large");
    }
}

// custom control for resizing the map
L.Control.resize = L.Control.extend({
    onAdd: function (map) {
        this._div = L.DomUtil.create('div', 'leaflet-control-resize');
        L.DomEvent.disableClickPropagation(this._div);
        this._div.innerHTML = '<i class="fas fa-up-right-and-down-left-from-center expand"></i>';
        this._div.onclick = resizeMapWindow;
        map.invalidateSize();
        return this._div;
    }
});

L.control.resize = function (opts) {
    return new L.Control.resize(opts);
}

class GameMap {

    constructor() {
        this.map = null;
        this.countriesGeoJSON = null;
        this.guessMarker = null;
        this.lineToGuess = null;
        this.closestPointToGuess = null;
        this.coloredSolutionOnMap = null;
        this.guessMarker = null;
    }

    async init() {
        await this.loadCountryGeoJSON();
        this.initLeafletMap();
    }

    initLeafletMap() {

        console.assert(this.countriesGeoJSON !== null, "GameMap init called before countriesGeoJSON is loaded")

        // only call this, when the geoJson data is loaded
        this.map = L.map('map', {
            zoomControl: false,
            zoomSnap: 0.1,
            minZoom: 2,
            zoomDelta: 0.1,
            wheelPxPerZoomLevel: 300,
        }).setView([0, 0], 2);

        this.map.setMaxBounds([[-90, -180], [90, 180]]);

        L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors',
            noWrap: true
        }).addTo(this.map);

        // controls
        L.control.zoom({
            position: 'bottomright'
        }).addTo(this.map);

        L.control.resize({
            position: 'topleft'
        }).addTo(this.map);

        // stop click on custom control from propagating to map
        $(".leaflet-control-resize").click(function (e) {
            e.stopPropagation();
        });

        // add countries
        L.geoJSON(this.countriesGeoJSON, {
            style: function (feature) {
                return {
                    color: "#000000",
                    weight: 1,
                    fillOpacity: 0.0
                };
            }
        }).addTo(this.map);

        const resizeObserver = new ResizeObserver(entries => {
            this.map.invalidateSize();
        });

        resizeObserver.observe(document.getElementById('map'));
    }

    async loadCountryGeoJSON() {
        let url = "/plantGuessr/assets/data/countries.geojson"

        const response = await fetch(url);
        this.countriesGeoJSON = await response.json();

    }

    getCountryGeoJSON() {
        return this.countriesGeoJSON;
    }

    getSolutionLocationsGeoJSON(solution) {
        let features = this.countriesGeoJSON.features.filter(function (country) {
            return solution.includes(country.properties.ISO);
        });

        let collection = turf.featureCollection(features);

        return collection;
    }

    colorSolution(solutionGeoJSON) {
        this.coloredSolutionOnMap = L.geoJSON(solutionGeoJSON, {
            style: function (feature) {
                return {
                    color: "#ff0000",
                    weight: 2,
                    fillOpacity: 0.2
                };
            }
        }).addTo(this.map);
    }

    drawLineFromGuessToClosestPoint() {
        this.lineToGuess = new L.Geodesic([this.guessMarker.getLatLng(),
        [this.closestPointToGuess.geometry.coordinates[1],
        this.closestPointToGuess.geometry.coordinates[0]]
        ]).addTo(this.map);


        this.lineToGuess.setStyle({
            color: "#0000ff",
            weight: 2
        });
    }

    addOnClick() {
        this.map.on('click', onGuessClick);
    }

    removeOnClick() {
        this.map.off('click', onGuessClick);
    }

    clear() {
        if (this.guessMarker !== null) {
            this.map.removeLayer(this.guessMarker);
            this.map.removeLayer(this.lineToGuess);
            this.map.removeLayer(this.coloredSolutionOnMap);
        }
    }

    getLeafletMap() {
        return this.map;
    }

    drawMarker(lat, lon) {
        this.guessMarker = L.marker([lat, lon]).addTo(this.map);
    }

    calculateDistanceFromGuessToSolution(guessLatLng, solutionGeoJSON) {
        let lat = guessLatLng.lat;
        let lon = guessLatLng.lng;

        let guess = turf.point([lon, lat]);
        let dist = 100000000;

        let self = this;

        // for each line in a polygon calculate the distance to the guess
        solutionGeoJSON.features.forEach(function (country) {

            if (turf.booleanPointInPolygon(guess, country)) {
                dist = 0;
                self.closestPointToGuess = guess;
                return;
            }

            let lines = turf.flatten(turf.polygonToLineString(country));

            lines.features.forEach(function (line) {
                var d = turf.pointToLineDistance(guess, line);
                if (d < dist) {
                    dist = d;
                    self.closestPointToGuess = turf.nearestPointOnLine(line, guess);
                }
            });
        });

        return dist;
    }

    calculateScore(dist) {
        var max_score = 5000;
        var min_dist = 0;
        var max_dist = 20000;

        // score is max_score at min_dist, 0 at max_dist
        var score = Math.round(Math.min(Math.max(max_score * (1 - (dist - min_dist) / (max_dist - min_dist)), 0), max_score), 0);

        return score;
    }

    evaluateGuess(e, self, species) {
        let map = e.target;

        self.guessMarker = L.marker(e.latlng).addTo(map);

        let isoCodes = species.getISOCodes();
        let solutionGeoJSON = self.getSolutionLocationsGeoJSON(isoCodes);
        self.colorSolution(solutionGeoJSON);

        let distance = self.calculateDistanceFromGuessToSolution(e.latlng, solutionGeoJSON);
        self.drawLineFromGuessToClosestPoint();

        let score = self.calculateScore(distance);

        return score
    }
}

class GameWindow {

    constructor() {
        this.map = new GameMap();
        this.score = {
            "total": 0,
            "rounds": []
        };
    }

    async init() {
        await this.checkCookieConsent();
        $("#game").show();
        await this.map.init();
    }

    async checkCookieConsent() {

        await new Promise(resolve => {
            // check if cookie is set
            if (document.cookie.indexOf("consent=true") >= 0) {
                $("#cookie-banner").hide();
                resolve();
            }

            $("#cookies").click(function () {
                document.cookie = "consent=true; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/"

                $("#cookie-banner").hide();

                resolve();
            });
        });
    }

    endGame() {
        $("#restart").show();
    }

    updateScoreDisplay(round) {
        $("#score-value").text(this.score.total);

        let html = `<tr>
        <td>${round}</td>
        <td>${this.score.rounds[round - 1]}</td>
        </tr>`

        $("#scoreboard").append(html);
    }

    showInfo() {
        var info = $(".infotext");

        if (info.hasClass("expanded")) {
            info.removeClass("expanded");
        } else {
            info.addClass("expanded");
        }
    }

    runLoadingAnimation() {
        $("#loader").show();

        Promise.all(promises).then(function () {
            $("#loader").hide();
        });
    }

    showSpeciesName(name) {
        $("#name").text(name).show();
    }

    reset() {
        $("#name").hide();
        $("#next").hide();

        this.map.clear();
    }

    showImages(images) {
        let self = this;

        $("#images").empty();

        images.forEach(function (img) {
            self.showImageLoader();
            $("#images").append(img.carouselItem());
            $("#images").show();
        });
    }

    showCarouselArrowsIfNecessary(numImages) {
        if (numImages > 1) {
            $(".carousel-control-prev").show();
            $(".carousel-control-next").show();
        } else {
            $(".carousel-control-prev").hide();
            $(".carousel-control-next").hide();
        }
    }

    showImageLoader() {
        let loaded = 0;
        let numImages = $(".plant-img").length;
        $("#imageloader").show();

        // show loader while images are loading
        $(".plant-img").on('load', function () {
            loaded++;
            if (loaded == numImages) {
                $("#imageloader").hide();
            }
        });
    }

    addOnMapClick() {
        this.map.addOnClick();
    }

    removeOnMapClick() {
        this.map.removeOnClick();
    }

    updateScore(score) {
        this.score.total += score;
        this.score.rounds.push(score);
    }


    evaluateGuess(e, game) {
        let self = game.window;
        let species = game.currentSpecies;
        let score = self.map.evaluateGuess(e, self.map, species);

        self.updateScore(score);
        let round = self.score.rounds.length;
        self.updateScoreDisplay(round);


        if (round < game.numRounds) {
            $("#next").show();
        } else {
            $("#next").hide();
            $("#restart").show();
        }
    }

}

class Game {

    constructor() {
        this.window = new GameWindow();
        this.numSpecies = 114800;
        this.numRounds = 5;
        this.currentSpecies = new Species();
    }

    async initGame() {
        await this.window.init();
        this.run();
    }

    async run() {

        let n = this.numRounds;

        for (var i = 0; i < n; i++) {

            await this.startNewRound();

            this.window.showImages(this.currentSpecies.getImages());

            // wait for user to click next
            await new Promise(resolve => $("#next").click(resolve));

            this.window.reset();
        }

        this.endGame();
    }

    async startNewRound() {
        await this.getRandomSpecies();
        this.window.addOnMapClick();
    }

    endRound(game) {
        let self = game;
        let gWindow = self.window;
        gWindow.removeOnMapClick();

        gWindow.showSpeciesName(this.currentSpecies.getScientificName());
    }

    async getRandomSpecies() {
        let randomSpeciesID = Math.floor(Math.random() * this.numSpecies);

        await this.currentSpecies.getSpecies(randomSpeciesID);
    }
}

class Species {

    constructor(id) {
        this.scientificName = null;
        this.isoCodes = null;
        this.catalogNumbers = null;
        this.owners = null;
        this.licenses = null;
        this.extensions = null;
        this.images = [];
    }

    async getSpecies(id) {
        let url = "https://nordegraf.github.io/plantGuessrData/json/species_" + id + ".json";

        const response = await fetch(url);
        let responseData = await response.json();

        this.scientificName = responseData.s;
        this.isoCodes = responseData.c;
        this.catalogNumbers = responseData.n;
        this.owners = responseData.r;
        this.licenses = responseData.l;
        this.extensions = responseData.i;
        this.images = [];

        this.generateImages();
    }

    generateImages() {
        let numImages = this.getNumberOfImages();

        for (var i = 0; i < numImages; i++) {
            let img = new plantImage(this.catalogNumbers[i],
                this.extensions[i],
                this.owners[i],
                this.licenses[i],
                i);

            this.images.push(img);
        }
    }

    getNumberOfImages() {
        return this.catalogNumbers.length;
    }

    getScientificName() {
        return this.scientificName;
    }

    getISOCodes() {
        return this.isoCodes;
    }

    getImages() {
        return this.images;
    }
}


class plantImage {

    constructor(catalogNumber, extension, author, license, id) {
        this.url = "https://inaturalist-open-data.s3.amazonaws.com/photos/" + catalogNumber + "/original." + extension;
        this.author = author;
        this.license = license;
        this.id = id;

        this.obj = $("<img />").attr('src', this.url).addClass('d-block plant-img');
    }

    carouselItem() {
        // image with id 0 gets the active class
        return `<div class='carousel-item${this.id == 0 ? " active" : ""}' id='plant-${this.id}'>
                <div class="image-container">
                ${this.obj.prop('outerHTML')}
                <div class="attribution">
                <span class="attribution">${this.author} | ${this.licenseAnchor(this.license)}</span>
                </div>
                </div>
                </div>`;
    }

    licenseAnchor(license) {
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
}

function resize_map() {
    var height = $(window).height();
    $("#map").height(height);
}

$(document).ready(function () {
    $(".infobutton").on('click', function () {
        game.window.showInfo();
    });

    $("#restart").on('click', function () {
        location.reload();
    });

});

var game = new Game();
var gWindow = new GameWindow();

// must be global, to have access to the game and rounds
function onGuessClick(e) {
    let map = e.target;

    gWindow.evaluateGuess(e, game);

    game.endRound(game);
}

$(document).ready(async function () {
    await game.initGame();
});