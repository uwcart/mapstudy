//Map panel

(function(){

/************** M-classification ****************/

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

/************** M-isomorph ****************/

//model for choropleth data overlay
var Choropleth = Backbone.Model.extend({
	defaults: {
		isomorphType: 'choropleth',
		classificationType: '',
		classedAttribute: '',
		classes: '',
		data: {}
	},
	setClasses: function(){
		var classedAttribute = this.get('classedAttribute');
		//get all of the values for the attribute by which the data will be classed
		var values = _.map(this.get('features'), function(feature){
			return parseFloat(feature.properties[classedAttribute]);
		});
		//get the d3 scale for the chosen classification scheme
		var classificationModel = classification.where({type: this.get('classificationType')})[0];
		var scale = classificationModel.scale(values, this.get('classes'));
		//set a new fillColor property for each feature with the class color value
		this.get('features').forEach(function(feature){
			feature.properties.layerOptions = {
				fillColor: scale(parseFloat(feature.properties[classedAttribute]))
			};
		});
		this.trigger('done');
	},
	initialize: function(){
		this.on('sync', this.setClasses);
	}
});

//a single collection holds all visual isomorphs
var isomorph = new Backbone.Collection([
	new Choropleth()
]);

//MODELS NEEDED
//-layers for each isomorph and each library
//-interaction elements and strategies for each interaction

/************** M-library ****************/

//Leaflet
var LeafletMap = Backbone.View.extend({
	el: '#m',
	events: {
		//DOM events--not sure I'll use this
	},
	initialize: function(){
		//attach an event for each interaction--remember to have user interaction trigger on map
		_.each(this.model.get('interactions'), function(interaction){
			this.on(interaction, this.recordInteraction);
		}, this);
	},
	render: function(){
		this.$el.html("<div id='map'>");
		return this;
	},
	setMap: function(){
		//remove default zoom control and interactions if noZoom option is true
		if (this.model.get('mapOptions.noZoom')){
			this.model.set('mapOptions.zoomControl', false);
			this.model.set('mapOptions.touchZoom', false);
			this.model.set('mapOptions.scrollWheelZoom', false);
			this.model.set('mapOptions.doubleClickZoom', false);
			this.model.set('mapOptions.boxZoom', false);
		};

		//instantiate map
		this.map = L.map('map', this.model.get('mapOptions'));

		//add initial map layers
		var layers = [];
		var baseTiles = L.tileLayer(this.model.get('baseTiles.url'), this.model.get('baseTiles.layerOptions')).addTo(this.map);
		layers.push(baseTiles);

		var dataLayerOptions = this.model.get('dataLayer.layerOptions');
		//get model based on isomorph type
		var dataLayerModel = isomorph.where({isomorphType: this.model.get('dataLayer.isomorph.type')})[0];
		//pass in necessary values
		dataLayerModel.set({
			classificationType: this.model.get('dataLayer.isomorph.classification'),
			classedAttribute: this.model.get('dataLayer.isomorph.classedAttribute'),
			classes: this.model.get('dataLayer.isomorph.classes')
		});
		dataLayerModel.on('done', function(){
			function style(feature){
				console.log(_.extend(feature.properties.layerOptions, dataLayerOptions));
				//combine layer options objects from config file and feature properties
				return _.extend(feature.properties.layerOptions, dataLayerOptions);
			};
			//add Leaflet overlay
			var dataLayer = L.geoJson(dataLayerModel.get('features'), {style: style}).addTo(this.map);
			layers.push(dataLayer);
		}, this);
		//go get the data!
		dataLayerModel.fetch({url: this.model.get('dataLayer.url')});

		// this.model.set('mapOptions.layers', layers); //can't do this because AJAX in isomorph model

		//layers control
		var baseLayers = {}, overlays = {};
		//add any additional base layers
		if (this.model.get('altTiles') && this.model.get('altTiles').length > 0){
			_.each(this.model.get('altTiles'), function(layerProps){
				baseLayers[layerProps.name] = L.tileLayer(layerProps.url, layerProps.layerOptions);
			});
		};
		if ($.isEmptyObject(baseLayers)){ baseLayers = null };
		//add any additional data layers
		if (this.model.get('dataOverlays') && this.model.get('dataOverlays').length > 0){
			_.each(this.model.get('dataOverlays'), function(layerProps){
				var dataOverlayModel = new eval(layerProps.isomorph.type);
				overlays[layerProps.name] = dataOverlayModel.get('layer');
			});
		};
		if ($.isEmptyObject(overlays)){ overlays = null };
		//add layers control if needed
		if (baseLayers || overlays){
			L.control.layers(baseLayers, overlays).addTo(this.map);
		};
	},
	recordInteraction: function(interaction){
		console.log(interaction);
		//send the interaction, timestamp, etc. to the interactions database table
	}
});

/************** set map view ****************/

function setMapView(options){
	var mapView = eval("new " + options.get('library') + "Map({model: options})");
	mapView.render().setMap();
};

/************** M-options ****************/

var MapOptions = Backbone.DeepModel.extend({
	url: "config/map.json"
});

//get options
var options = new MapOptions();
options.on('sync', setMapView);
options.fetch();

})();