//Map panel

(function(){

/************** map.dataLayer.techique.classification ****************/

var Quantile = Backbone.Model.extend({
	defaults: {
		type: 'quantile'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.quantile()
			.range(classes);
		//assign array of values as scale domain
		scale.domain(values);
		//done
		return scale;
	}
});

var EqualInterval = Backbone.Model.extend({
	defaults: {
		type: 'equal interval'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.quantile()
			.range(classes);
		//assign two-value array as scale domain
		scale.domain([d3.min(values), d3.max(values)]);
		//done
		return scale;
	}
});

var NaturalBreaks = Backbone.Model.extend({
	defaults: {
		type: 'natural breaks'
	},
	scale: function(values, classes){
		//create scale generator
		var scale = d3.scale.threshold()
			.range(classes);
		//cluster data using ckmeans clustering algorithm to create natural breaks
		var clusters = ss.ckmeans(values, classes.length);
		//set domain array to cluster minimums
		var domainArray = clusters.map(function(d){
			return d3.min(d);
		});
		//remove first value from domain array to create class breakpoints
		domainArray.shift();
		//assign array of remaining cluster minimums as domain
		scale.domain(domainArray);
		//done
		return scale;
	}
});

var Unclassed = Backbone.Model.extend({
	defaults: {
		type: 'unclassed'
	},
	scale: function(values, rangeBounds){
		//create scale generator
		var scale = d3.scale.linear()
			.range(rangeBounds);
		//assign two-value array as scale domain
		scale.domain([d3.min(values), d3.max(values)]);
		//done
		return scale;
	}
});

//a single collection holds all classification models
var classification = new Backbone.Collection([
	new Quantile(),
	new EqualInterval(),
	new NaturalBreaks(),
	new Unclassed()
]);

/************** map.dataLayer.technique ****************/

//model for choropleth data overlay
var Choropleth = Backbone.Model.extend({
	defaults: {
		techniqueType: 'choropleth',
		classificationType: '',
		expressedAttribute: '',
		classes: '',
		dataLayer: {}
	},
	setClasses: function(){
		var expressedAttribute = this.get('expressedAttribute');
		//get all of the values for the attribute by which the data will be classed
		var values = _.map(this.get('features'), function(feature){
			return parseFloat(feature.properties[expressedAttribute]);
		});
		//get the d3 scale for the chosen classification scheme
		var classificationModel = classification.where({type: this.get('classificationType')})[0];
		var scale = classificationModel.scale(values, this.get('classes'));
		//set a new fillColor property for each feature with the class color value
		this.get('features').forEach(function(feature){
			feature.properties.layerOptions = {
				fillColor: scale(parseFloat(feature.properties[expressedAttribute]))
			};
		});
		this.trigger('done');
	},
	initialize: function(){
		this.on('sync', this.setClasses);
	}
});

//a single collection holds all visual techniques
var techniques = new Backbone.Collection([
	new Choropleth()
]);

/************** map.interactions ****************/

//basic interaction model
var Interaction = Backbone.Model.extend({
	defaults: {
		interaction: "",
		timestamp: "",
		userId: userId,
		question: 0
	},
	url: "php/interactions.php",
	record: function(){
		var date = new Date();
		this.set({
			timestamp: date.toUTCString(),
			question: question
		});
		this.save();
	},
	create: function(events){
		//events is an object in the form of {event1: context1, event2: context2}
		for (var e in events){
			var context = events[e];
			var model = this;
			context.on(e, function(){
				model.record();
			});
		}
	}
});

/************** map.library ****************/

//Leaflet
var LeafletMap = Backbone.View.extend({
	el: '#m',
	events: {
		//DOM events--not sure I'll use this
	},
	initialize: function(){

	},
	render: function(){
		this.$el.html("<div id='map'>");
		return this;
	},
	setBaseLayer: function(baseLayer, i){
		//create leaflet tile layer
		var leafletBaseLayer = L.tileLayer(baseLayer.source, baseLayer.layerOptions);
		//only add first base layer to the map
		if (i==0){ leafletBaseLayer.addTo(this.map); };
		//add to array of base layers
		this.model.attributes.leafletBaseLayers.push(baseLayer);
	},
	setDataLayer: function(dataLayer){
		//get layer options
		var dataLayerOptions = dataLayer.layerOptions;
		//get model based on technique type
		var dataLayerModel = techniques.where({techniqueType: dataLayer.technique.type})[0];
		//pass in necessary values
		dataLayerModel.set({
			classificationType: dataLayer.technique.classification,
			expressedAttribute: dataLayer.expressedAttribute,
			classes: dataLayer.technique.classes,
			dataLayer: dataLayer
		});
		//set up AJAX callback
		dataLayerModel.on('done', function(){
			var model = this.model, view = this;
			var className = dataLayerModel.get('dataLayer').name.replace(/\s|\:/g, '-');
			function style(feature){
				//combine layer options objects from config file and feature properties
				return _.extend(feature.properties.layerOptions, dataLayerOptions);
			};
			//implement retrieve interaction if listed in config file
			function onEachFeature(feature, layer){
				if (model.get('interactions.retrieve')){
					var popupContent = "<table>";
					if (model.get('interactions.retrieve.attributes')){
						var retrieveAttributes = model.get('interactions.retrieve.attributes');
						retrieveAttributes.forEach(function(attr){
							popupContent += "<tr><td class='attr'>"+attr+":</td><td>"+feature.properties[attr]+"</td></tr>";
						});
					} else {
						var attr = dataLayerModel.get('expressedAttribute');
						popupContent += "<tr><td class='attr'>"+attr+":</td><td>"+feature.properties[attr]+"</td></tr>";
					};
					popupContent += "</table>";
					layer.bindPopup(popupContent);
					if (model.get('interactions.retrieve.event') == 'hover'){
						layer.on({
							mouseover: function(){
								//fix for popup flicker
								var bounds = this.getBounds();
								var maxLat = bounds.getNorth();
								var midLng = bounds.getCenter().lng;
								this.openPopup([maxLat, midLng]);
							},
							mouseout: function(){ this.closePopup() }
						});
					};
					layer.on('popupopen', function(){
						view.trigger('popupopen');
					});
				};
			};
			//add Leaflet overlay
			var leafletDataLayer = L.geoJson(dataLayerModel.get('features'), {
				style: style,
				onEachFeature: onEachFeature,
				className: className
			});
			//render immediately by default
			if (typeof dataLayer.renderOnLoad === 'undefined' || dataLayer.renderOnLoad == 'true'){
				leafletDataLayer.addTo(this.map);
				//reset cursor if needed
				if (!model.get('interactions.retrieve') && model.get('interactions.pan')){
					$("."+className).css('cursor', "grab");
				};
			};
			//add to layers
			model.attributes.leafletDataLayers.push(leafletDataLayer);
		}, this);
		//go get the data!
		dataLayerModel.fetch({url: dataLayer.source});
	},
	setMap: function(){
		//remove default zoom control and interactions if no zoom interaction
		if (!this.model.get('interactions.zoom')){
			this.model.set('mapOptions.zoomControl', false);
			this.model.set('mapOptions.touchZoom', false);
			this.model.set('mapOptions.scrollWheelZoom', false);
			this.model.set('mapOptions.doubleClickZoom', false);
			this.model.set('mapOptions.boxZoom', false);
		};
		//remove default panning interaction if no pan interaction
		if (!this.model.get('interactions.pan')){
			this.model.set('mapOptions.dragging', false);
		};
		//create Leaflet layers arrays
		this.model.set({
			leafletBaseLayers: [],
			leafletDataLayers: []
		});

		//instantiate map
		this.map = L.map('map', this.model.get('mapOptions'));

		//add initial tile layers
		var baseLayers = this.model.get('baseLayers');
		_.each(baseLayers, this.setBaseLayer, this);

		//add each data layer
		var dataLayers = this.model.get('dataLayers');
		_.each(dataLayers, this.setDataLayer, this);

		//designate events to listen to with contexts for each interaction
		var interactionCreation = {
			zoom: {zoomstart: this.map},
			pan: {dragend: this.map},
			retrieve: {popupopen: this}
		};

		//create a new interaction object for each interaction with logging
		var interactions = this.model.get('interactions');
		for (var interaction in interactionCreation){
			if (interactions[interaction].logging){
				var i = new Interaction({interaction: interaction});
				i.create(interactionCreation[interaction]);
			};
		};
	}
});

/************** set map view ****************/

function setMapView(options){
	var mapView = eval("new " + options.get('library') + "Map({model: options})");
	mapView.render().setMap();
};

/************** map config ****************/

var MapConfig = Backbone.DeepModel.extend({
	url: "config/map.json"
});

//get map configuration options
var mapConfig = new MapConfig();
mapConfig.on('sync', setMapView);
mapConfig.fetch();

})();