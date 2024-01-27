---
layout: default
title: FAQ
---

## How to play?
When starting a round the game shows you a maximum of 10 images of the same species. Your task is to guess where in the world this species can be found. You can do this by clicking on the map. The closer you are to the actual distribution of the species, the more points you get. One game consists of five rounds. After each round you will be shown the correct distribution of the species and the species name.

## What countries can be selected?
Strictly speaking the game is not using countries, but rather all regions that have a ISO 3366-1 alpha-2 code. This includes countries, but also dependent terretories and some special areas. For example, a lot of the british or french overseas terretories like French Guiana or St.Helena have their own code.

A full list of ISO codes is given on [Wikipedia](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements).

The map data is taken from [Natural Earth](https://www.naturalearthdata.com/). To be more specific it is the _1:10m Cultural Vectors_ dataset with ISO POV, converted to GeoJSON. Some disputed areas are not assigned to any ISO code. As the regions borders are drawn into the map, you will be able to see which areas are not included in any region.

In no way does plantGuessr take a political stance on any borders, disputed areas or similar. If you have any inquiries about the map data, please contact Natural Earth.

## Where does the data come from?
The distribution data is taken from the [iNaturalist DarwinCore Archive](https://www.inaturalist.org/pages/developers). It consists of all research grade observations iNaturalist shares with GBIF. Observations and images in the dataset are licensed under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/),
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) or [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). The images shown to you are hosted on iNaturalist and the respective right holders to them are always given on the image.

If you interested in the way the data was processed, you can find the Python files used in the [plantGuessr GitHub Repository](https://nordegraf.github.io/plantGuessr/).

As mentioned above the map data is taken from [Natural Earth](https://www.naturalearthdata.com/) and is public domain.

## How does the scoring work?
The score is calculated from the distance of your guess to the closest point on the border of all regions a species is found in. The closer you are to the border, the more points you get. The maximum score per guess is 5000 points and gets awarded if you click inside of any region a species is found in.

## I found some way to cheat!
It's really easy to cheat plantGuessr. As the site is hosted on GitHub Pages it is static and all the data is available to you. You can simply open the developer tools, find the id of the species currently shown and get it's distribution from the corresponding JSON object in the [plantGuessrData](https://github.com/Nordegraf/plantGuessrData) Repository.