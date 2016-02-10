# API Documentation

## About the API documentation

MapStudy is a flexible framework for creating map-based survey applications. It includes a range of components that are selected by setting and extending the options in the *.json* files within the *config* directory. For now, those files must be edited manually in a basic text editor such as Sublime or Notepad++. Hopefully there will eventually be a helper GUI for setting up the config files. 

The API documentation lists the available options in the config files. Each option is shown as code, with the option key to the left of a semicolon and each explicit possible value `-between dashes-`.

This documentation assumes a basic working knowledge of JSON formatting and geographic data structure.

## Setup

1. Clone or download a zipped copy of the framework from the [Github page](https://github.com/uwcart/mapstudy).

2. Unzip the files and place them where you want to provide access to the survey&mdash;either on a public server or a private localhost server.

3. Replace the *icon.png* file in the *img* folder with your own icon if desired.

4. If you will create a thematic map, gather geographic data and convert to GeoJSON format or store it in a PostGIS database. Geographic data should include every feature that will be mapped and each attribute that will be used to generate the thematic map. Thematic attributes should be numerical. Options for adding data to the map are covered in the *map.json* section below. A good source of geographic base data is [Natural Earth](http://www.naturalearthdata.com/).

5. If you plan to embed a static map image or pre-rendered web map from a service such as [CartoDB](https://cartodb.com/), prepare that map separately. *Note that if you do this, you lose the benefit of the embedded user interaction logging.*

6. Set up a PostgreSQL, MySQL, or Microsoft Access database to store question answers and interaction logs. The MapStudy application will need administrator-level access to that database.

7. Edit and extend each *.json* file in the *config* directory using the options below. Your edits should be reflected immediately in the browser upon loading or reloading *index.html*.

## Config files

### styles.json

This config file is set up by default to style two page sections: the header and the footer. Other sections may be added as additional section objects, but it is not recommended.

#### styles.sectionId

	"sectionId": -"header"- -"footer"- -"m"- -"q"-
	
The `id` attribute of each HTML `<section>` element on the page.

`-"header"-`: The page header; the banner on top of the page. Orange background with a "MapStudy Template" heading and MapStudy icon by default. If there is no section object with a `sectionId` of `header`, a strip of white space will appear at the top of the page.

`-"footer"-`: The page footer; the strip at the bottom of the page. Orange background with placeholder text content by default. Put whatever you want in it, or nothing. If there is no section object with a `sectionId` of `footer`, a strip of white space will appear at the bottom of the page.

`-"m"-`: The section holding the map, on the left half of the main part of the web page. You can add a third section object for this or change one of the existing objects, but it's not recommended. Any `cssAttributes` will override the styles in *style.css*, but any HTML content will be overridden.

`-"q"-`: The section holding the questions, on the right half of the main part of the web page. See `-"m"-` above.

#### styles.cssAttributes

	"cssAttributes": {}

An object holding all CSS styles that will be used to style the section. Any styles added to the object will override those contained in *style.css*. Be careful.

By default, only one style is added to the `cssAttributes` object:

#### styles.cssAttributes.background-color

		"background-color": "color"

An RGB or HEX value that will be the background color of the section. The default `background-color` is orange.

#### styles.logo-url

	"logo-url": "url"

A URL or relative path to the logo that appears in the `header` section. Only works in an object containing a `sectionId` of `header`. By default, this is set to `"img/logo.png"`; in general, there is no need to change this&mdashjust replace *logo.png* in the *img* folder with a file that holds your logo that's also called *logo.png*. The logo should be at least 64 pixels high.

#### styles.content

	"content": "HTML content"

An HTML string that will be added to the section. The `content` of the `header` section object will automatically be formatted as an `<h1>` heading. The content of the `footer` section will be 80% of the height of normal paragraph text on the page. Adding social media buttons here should work.

---

### map.json

This config file holds the configuration options necessary to create the map. MapStudy will eventually support creating web maps with interaction logging in [Leaflet](http://leafletjs.com/), [Mapbox-GL](https://www.mapbox.com/mapbox-gl-js/api/), and [D3](http://d3js.org/), and maps with no interaction logging as any of the first three plus a static image, REST service, or embedded iframe with any other web mapping service (e.g. [CartoDB](https://cartodb.com/) and [ArcGIS Online Viewer](https://www.arcgis.com/home/webmap/viewer.html)).

#### map.library

	"library": -"Leaflet"- -"Mapbox-GL"- -"D3"- -"image"- -"REST"- -"iframe"-

The web mapping library or service to use to create the map. Currently only supports `Leaflet`.

#### map.interactions

	"interactions": {
		-"zoom"- 
		-"pan"- 
		-"retrieve"- 
		-"overlay"-
		-"search"-
		-"filter"-
		-"sequence"- 
		-"reexpress"- 
		-"rotate"- 
		-"resymbolize"- 
		-"reproject"-
	}

An object containing the interactions that should be enabled on the map. Each interaction in turn references an object designating whether the interaction should be logged and options for its implementation.

#### map.interactions.zoom

		-"zoom"-: { -"logging"- }

Zoom interaction. Must be included to allow the user to change the zoom level/scale of the map. If an empty object, `logging` is considered to be `false`.

#### map.interactions[interaction].logging

			-"logging"-: -true- -false-

Whether the interaction should be logged. False by default. Available for each interaction.

#### map.interactions.pan

		-"pan"-: { -"logging"- }

Pan interaction. Must be included to allow the user to change map center by dragging the map.

#### map.interactions.rotate

		-"rotate"-: { -"logging"- }

Rotate interaction. Allows the user to rotate the map. Only available with Mapbox-GL and D3 libraries.

#### map.interactions.retrieve

		-"retrieve"-: { -"logging"- }

Retrieve interaction. Implemented as a pop-up on the map. If an empty object, options are considered to be defaults.

#### map.interactions.overlay

		-"overlay"-: { -"logging"- "dataLayers" }

Overlay interaction. Must be included to allow the user to add or remove data layers on the map. Must include a list of `dataLayers` for which to enable the interaction.

#### map.interactions.overlay.dataLayers

		-"dataLayers"-: []

An array containing the names of `dataLayers` to allow users to add and remove with a layers control. Required. Each data layer will be represented by a checkbox in the layers control, allowing any number of included layers to be added or removed.

#### map.interactions.underlay

		-"underlay"-: { -"logging"- }

Underlay interaction. Must be included to allow the user to change base layers on the map. If included, the names of all `baseLayers` will be shown with radio buttons in a layers control. Only one base layer can appear on the map at a time.

#### map.interactions.search

		-"search"-: { -"logging"- "dataLayers" }

Search interaction. Creates a search box on the map.

#### map.interactions.search.dataLayers

			"dataLayers": []

An array of the `dataLayers` to include in the search. Must have at least one value to enable searching.

#### map.interactions.filter

		-"filter"-: { -"logging"- "dataLayers" -"tool"- }

Filter interaction. Creates a filter tool on the map.

#### map.interactions.filter.dataLayers

			"dataLayers": []

An array of the `dataLayers` to include in the filter tool. Must have at least one value to enable filtering. Each data layer will have its own line in the filter tool.

#### map.interactions.filter.tool

			-"tool"-: -"slider"- -"logic"-

Which interface tool to use for filtering. Default is `slider`.

`-"logic"-`: Implements a dropdown menu with "equal to", "not equal to", "greater than", and "less than" options, followed by a text box for user input, followed by a dropdown menu with blank, "and", and "or" options, followed by a repeat of the first dropdown and text box (e.g., "attribute is greater than 12 and less than 24"; "attribute is equal to 15"). Data layers on map will respond immediately to user input.

`-"slider"-`: Implements a slider with two handles as the filter tool. Data layers on map will respond immediately to user input.

#### map.interactions.sequence

		-"sequence"-: { -"logging"- -"attributes"- -"tool"- }

Sequence interaction. Allows the user to change the expressed attribute separately for each of the currently-viewed `dataLayers` that include two or more of the listed attributes plus the layer's `expressedAttribute`.

#### map.interactions.sequence.attributes

			-"attributes"-: []

An array of attributes through which the user can sequence. The attributes will sequence in the order listed in the array. Must have at least two values to enable sequencing.

#### map.interactions.sequence.tool

			-"tool"-: -"buttons"- -"slider"-

Which interface tool to user for sequencing. Default is `buttons`.

`-"buttons"-`: Implements forward and back buttons on the map with which to sequence through the attributes.

`-"slider"-`: Implements a slider on the map with which to sequence through the attributes.

#### map.interactions.reexpress

		-"reexpress"-: { -"logging"- }

Reexpress interaction. For each visible data layer, allows the user to change the visual technique in which the `dataLayer` is expressed to any of the techiques listed in the layer's `techniques` array.

#### map.interactions.resymbolize

		-"resymbolize"-: { -"logging"- -"reclassify"- -"rescale"- -"recolor"- }

Resymbolize interaction. Allows the user to manipulate the classification scheme via the legend. If included, users will be able to change the classification parameters of graduated maps (choropleth or proportional symbol), change the symbol scale or interval (proportional symbol, dot, isarithm), and/or change the symbol color (choropleth and proportional symbol). If `reclassify`, `rescale`, and `recolor` are all omitted, all of their functionality will be included by default; if one or more are included, only those that are included as `true` will be available.

#### map.interactions.resymbolize.reclassify

	-"reclassify": -true- -false-

Allows the user to change the classification scheme, the number of classes, and the class breakpoints. Only available for choropleth and proportional symbol maps.

#### map.interactions.resymbolize.rescale

	-"rescale": -true- -false-

Allows the user to change the symbol scaling if a proportional symbol map, or the interval if a dot or isarithm map.

#### map.interactions.resymbolize.recolor

	-"recolor": -true- -false-

Allows the user to change the symbol color. For a choropleth map, the user may choose from any sequential ColorBrewer scale. For proportional symbol map, the user may enter any HEX value or choose from a palette the fill color of the symbols.

#### map.interactions.reproject

		-"reproject"-: { -"logging"- -"projections"- }

Allows the user to change the map projection. Only available with the D3 library.

#### map.interactions.reproject.projections

			-"projections"-:[]

An array of `projection` objects with the projection name and D3-style projection parameters for each alternative projection to include. Must have at least one projection object to enable reprojection.

#### map.mapOptions

	-"mapOptions"-: { -library options- -legend- }

An object to hold any map options applied on the instantiation of a Leaflet, Mapbox-GL, or REST map. Not available for any other `library`. If no `mapOptions` are included, library defaults will be applied. Refer to the [Leaflet](http://leafletjs.com/reference.html#map-options) or [Mapbox-GL](https://www.mapbox.com/mapbox-gl-js/api/#Map) documentation for lists of possible options for those libraries. REST `mapOptions` will be added as parameters to the map URL, and are thus dependent on the map server configuration. The `legend` option is a special option, described below.

#### map.mapOptions.legend

	-"legend"-: -true- -false-

If `legend` is included and `false`, no legend will be included on the map. If `legend` is excluded or `true`, a legend showing symbols for all `dataLayers` will be included on the map.

#### map.projection

	-"projection"-: { "name" -"options"- }

An object containing the projection name and parameters for a D3 projection. Only available with the D3 `library`. Must be included to instantiate a D3 map.

#### map.projection.name

		"name": projection name

The name of the D3 projection, a string. Required. All [standard projections](https://github.com/mbostock/d3/wiki/Geo-Projections#standard-projections) and [extended projections](https://github.com/d3/d3-geo-projection/#extended-geographic-projections) are supported. The `name` is lowercase and does not include a reference to the `d3.geo` library object or parentheses (e.g. `"albers"`, not `"d3.geo.albers()"`).

#### map.projection.options

		-"options"-: {}

An object containing the [projection parameters](https://github.com/mbostock/d3/wiki/Geo-Projections) for the chosen projection. If not included, options will be projection defaults. Refer to the example block for your chosen projection to see which parameters are used. While in writing D3 code, each projection parameter is implemented as a selection operator method with the values as method parameters, here you give the parameter as an object key string followed by the parameter values. For example:

	//D3 projection block in JavaScript
	projection = d3.geo.albers()
	    .center([0, 55.4])
	    .rotate([4.4, 0])
	    .parallels([50, 60])
	    .scale(6000)
	    .translate([width / 2, height / 2]);

in *map.json* becomes

	"projection": {
		"name": "albers",
		"options": {
			"center": [0, 55.4],
			"rotate": [4.4, 0],
			"parallels": [50, 60],
			"scale": 6000,
			"translate": ["width / 2", "height / 2"]
		}
	}

Make sure that any value that is either a string or a mix of numbers and strings is represented as a string with double-quotes. The variables `"width"` and `"height"` will be recognized as the map width and the map height. You may wish to adjust these after you see the instantiated map.

#### map.baseLayers

	-"baseLayers"-: [{
		"name"
		"source"
		"layerOptions"
	}]

An array of objects containing the information needed to add a basemap layer for any `library`. Only the first base layer object will be rendered on the map on load. All `baseLayers` will be included as base layer options in the layers control if `underlay` is an included interaction.

#### map.baseLayers[i].name

		"name": layer name

The name of the base layer; a string. Required. If `overlay` is included in the `interactions`, this name will appear in the layers control on the map.

#### map.baseLayers[i].source

		"source": -base layer URL- -"postgis:"+tablename-

The URL of a [raster tile layer](http://leafletjs.com/reference.html#tilelayer) for a Leaflet map, a TopoJSON or GeoJSON file or Postgis table containing the basemap geometry for a Mapbox-GL or D3 map, a RESTful web map service, an iframe embed link, or a static image in *.png*, *.jpg*, or *.tif* format. A string. Required to add the layer to the map for all libraries except Mapbox-GL. 

For a Leaflet map, the standard URL format is `"http://{s}.domain.com/tiles/{z}/{x}/{y}.png"` where `{s}` is a variable standing for the server instance, `{z}` stands for the zoom level, `{x}` stands for the left-to-right horizontal tile coordinate, and `{y}` stands for the top-to-bottom vertical tile coordinate. Check for specifics of the tileset you want to use by viewing a single tile as an image in a browser and noting the contents of the URL bar.

For a D3 map, the `source` URL should point to a TopoJSON or GeoJSON file containing the geometry to be mapped. Alternatively, the value of `source` can be a string containing `"postgis:"` and the name of the table in a PostGIS database (with no space after the colon). In the latter case, PostgreSQL database connection parameters must be added to the *database.php* config file. The geometry will be added to the map as [data](https://github.com/mbostock/d3/wiki/Selections#data) to allow for individualized feature styles, and drawn as SVG paths.

For a Mapbox-GL map, `source` is optional and may be a raster tileset URL, a vector tileset URL, a TopoJSON or GeoJSON file, or a PostGIS table. If included, it will be used to add a [data source](https://www.mapbox.com/mapbox-gl-style-spec/#sources) to the styles object.

For an iframe, the `source` should be the iframe `src` URL given in the embed HTML provided by the map service. Only include the URL; do not include the rest of the markup.

For a REST service, the `source` should be the base URL with or without option parameters. For a static map image, the `source` should be a URL pointing to the image.

#### map.baseLayers[i].layerOptions

		"layerOptions": -{}- -URL-

Typically, an object containing [Leaflet TileLayer options](http://leafletjs.com/reference.html#tilelayer-options), [SVG styles](http://www.w3.org/TR/SVG/styling.html#SVGStylingProperties) for all layer paths drawn by D3, [Mapbox-GL styles](https://www.mapbox.com/mapbox-gl-style-spec), or REST parameters. May also be a URL string pointing to a JSON file that contains this information.

For a D3 map, SVG styles added to each GeoJSON feature's `properties` object will also be applied to the features on an individual basis. This is useful for making, say, a political map of the world with each country given a unique fill color.

For a Mapbox-GL map, `layerOptions` is required and should contain or point to a JSON-formatted object that conforms to the Mapbox-GL [style reference](https://www.mapbox.com/mapbox-gl-style-spec), including at least `version`and `layers` properties, as well as `sources` if `baseLayer.source` is omitted.

For REST services, each option will be translated into a URL parameter key-value pair. For example:

	"baseLayers": [{
		"name": "MassGIS",
		"source": "http://giswebservices.massgis.state.ma.us/geoserver/wms",
		"layerOptions": {
			"VERSION": "1.1.1",
			"REQUEST": "GetMap",
			"SERVICE": "WMS",
			"LAYERS": "massgis:GISDATA.TOWNS_POLYM,massgis:GISDATA.NAVTEQRDS_ARC",
			"STYLES": "Black_Lines"
		}
	}]

when sent to the server will translate as:

	http://giswebservices.massgis.state.ma.us/geoserver/wms?VERSION=1.1.1&REQUEST=GetMap&SERVICE=WMS&LAYERS=massgis:GISDATA.TOWNS_POLYM,massgis:GISDATA.NAVTEQRDS_ARC&STYLES=Black_Lines

The REST parameters may also be added in the above format to `baseLayer.source` and `layerOptions` omitted.

#### map.dataLayers

	-"dataLayers"-: [{
		"name"
		"source"
		"expressedAttribute"
		-"displayAttributes"-
		-"renderOnLoad"-
		-"layerOptions"-
		"techniques"
	}]

An array of objects containing information about the data to be visualized on the map, if any. Only available for Leaflet, Mapbox-GL, and D3 maps. Layers will be rendered on the map from bottom to top in the order in which they are listed in the array.

#### map.dataLayers[i].name

		"name": layer name

The name of the data layer; a string. Required. If `overlay` is included in the `interactions`, this name will appear in the layers control on the map.

#### map.dataLayers[i].source

		"source": -layer data URL- -"postgis:"+table name-

A URL string pointing to a TopoJSON or GeoJSON file containing the data to be mapped, or the string "postgis:" followed by the name of a PostGIS table from which to retrieve the data (with no space after the colon). In the latter case, PostgreSQL database connection parameters must be added to the *database.php* config file. 

The data should include feature geometries with *unprojected* WGS-84 coordinates. Feature geometries must be polygons unless creating a proportional symbol or isarithmic layer, and must be points if creating an isarithmic layer. The data must include at least one numerical attribute in each feature's `properties` object. Including feature names and IDs in the `properties` is encouraged, as these will generally be useful to show in pop-ups if the `retrieve` interaction is included.

For a Mapbox-GL map, the `source` may also be a vector tileset. The data retrieved by `source` will be added as a [data source](https://www.mapbox.com/mapbox-gl-style-spec/#sources) to the styles object.

#### map.dataLayers[i].expressedAttribute

		"expressedAttribute": attribute name

The name of the numerical attribute that will be visually expressed on the map; a string. Required. Must correspond to a key within each feature's `properties` object that references a numerical value (or no value or `null` if null for that feature).

#### map.dataLayers[i].displayAttributes

		-"displayAttributes"-: []

An array of one or more attributes to include in that layer's pop-ups if the `retrieve` interaction is included, in the search tool if the `search` interaction is included, and in the filter tool if the `filter` interaction is included. Only categorical attributes with string values will be searchable (e.g., "name" but not "population"). Only numerical attributes will be added to the filter tool (e.g., "population" but not "name"), and will be accessible via a drop-down menu in the data layer's line in the filter tool. If `retrieve`, `search`, or `filter` are included but no `displayAttributes` are given, pop-ups and tools will be implemented using only the layer's `expressedAttribute`.

#### map.dataLayers[i].renderOnLoad

		-"renderOnLoad"-: -true- -false-

Whether to render the layer when the map loads. Optional; default is `true`. If multiple `dataLayers` are included with some having `renderOnLoad` set to `false`, the only way those layers will be visible is by including an `overlay` interaction that includes those layers. In this case, those layers will be unchecked in the layers control until selected by the user. 

#### map.dataLayers[i].layerOptions

		-"layerOptions"-: -{}- -URL-

An object or URL string pointing to a JSON file containing [Leaflet Path options](http://leafletjs.com/reference.html#path-options), [SVG styles](http://www.w3.org/TR/SVG/styling.html#SVGStylingProperties) for all layer paths drawn by D3, or [Mapbox-GL style layers](https://www.mapbox.com/mapbox-gl-style-spec/#layers). Optional. Properties added here that conflict with the `technique` classification will be overridden for each feature to which the classification is applied (i.e., any not null values).

#### map.dataLayers[i].techniques

		"techniques": [{
			"type"
			-"classification"-
			-"classes"-
			-"symbol"-
			-"interval"-
			-"size"-
		}]

An array of objects containing the thematic mapping techniques, including the map type and classification parameters for the data layer. At least one technique object is required. The first technique object in the array will be used for the layer's initial expression; all other techniques for the layer will only be available to the user if `map.interactions.reexpress` is included.

#### map.dataLayers[i].techniques[i].type

			"type": -"choropleth"- -"proportional symbol"- -"dot"- -"isarithmic"-

The [thematic map type](https://en.wikipedia.org/wiki/Thematic_map). Required. Note that only a data layer with a `proportional symbol` or `isarithmic` technique type can use point feature data. 

#### map.dataLayers[i].techniques[i].classification

			"classification": -"quantile"- -"equal interval"- -"natural breaks"- -"unclassed"-

The classification technique for a choropleth or proportional symbol map. Which techique is chosen determines how the data values of the `expressedAttribute` are grouped for display on the map. Required for `choropleth` and `proportional symbol` types, optional for `isarithmic` type, and unavailable for `dot` type.

A `quantile` classification groups the data into classes with an equal *number of* data values in each class. This works best when you want to create a map with the same number of features in each class but don't care about how wide the class ranges are.

An `equal interval` classification groups the data into classes each with an *equal range* of values (e.g., 0-10, 10-20, 20-30, etc.). This works best for data that are spread evenly across the entire data range, and usually turns out poorly if there is a small number of mapped features. It must be used if `type` is `isarithmic` and `classification` is included.

A `natural breaks` classification uses the [Cartesian k-means](http://www.cs.toronto.edu/~norouzi/research/papers/ckmeans.pdf) algorithm to minimize the statistical distances between data points within each class. This classification is generally considered optimal for identifying groups of data values.

An `unclassed` classification creates a [linear scale](https://github.com/mbostock/d3/wiki/Quantitative-Scales#linear-scales) to map each input data value to an output value interpolated between the first two values given in the `classes` array. Thus, it results in a map with no defined classes. This is the most common classification for proportional symbol maps and the least common for choropleth maps.

#### map.dataLayers[i].techniques[i].classes

			-"classes"-: []

An array containing the output values for each class. Required if `classification` is used. Array values should be numerical for proportional symbol maps&mdash;representing the diameter or width of each feature's symbol&mdash;and hexadecimal color strings for a choropleth map (e.g., `"#FFFFFF"`). The number of values in the array will correspond with the number of classes created. For choropleth maps, unless testing various color schemes, it is recommended you choose a colorblind-safe color scheme from [Colorbrewer](http://colorbrewer2.org/).

#### map.dataLayers[i].techniques[i].symbol

			-"symbol"-: -"circle"- -image url-

Symbol to use for proportional symbol or dot map. Optional; default is `circle`. Not available to choropleth or isarithmic maps. For proportional symbol maps, if the dataset consists of point features, symbols will be placed on point coordinates; otherwise, symbols will be placed on the centroids of polygon features. While use of something other than `circle` for a dot map is possible, it is not recommended.

#### map.dataLayers[i].techniques[i].interval

			-"interval"-: value interval

The data interval by which to separate isarithms on an isarithmic map, or the ratio of data value to one dot for a dot map. Optional. Unavailable for choropleth or proportional symbol maps.

For an isarithmic map, there are two ways to determine line separation. One way is to designate a value for `interval` by which each line will be separated on the map. The other is to omit `interval`, include `"classification": "equal interval"`, and to include `classes` as an array with a number of arbitrary values corresponding to the desired number of isarithms on the map. If both `interval` and `classification` are omitted, the default line separation will be 10.

For a dot map, the value of `interval` is the denominator by which the feature's expressed attribute value will be divided to determine the number of dots to add within the boundaries of a feature. Omitting `interval` will result in a default of one dot for every 10 units. For example, if the expressed attribute value for a feature is `15,607`, by default there will be 1,561 dots scattered within that feature's boundaries. Designating `interval` as `1` will result in a dot being added for each whole number increase in the expressed attribute value, resulting in a true dot (as opposed to dot density) map.

#### map.dataLayers[i].techniques[i].size

			-"size"-: size

The size of dots on a dot map or isarithms on an isarithmic map; a number. Not available for other technique types. Optional; default is 1 pixel. For a dot map, `size` is the dot diameter or `symbol` width. For an isarithmic map, `size` is the line width of each isarithm.